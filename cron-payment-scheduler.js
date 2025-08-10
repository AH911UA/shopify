const cron = require('node-cron');
const moment = require('moment-timezone');
const axios = require('axios');
const prisma = require('./lib/prisma');

// Импортируем функцию retrySubscription из retryController
const { retrySubscription } = require('./controllers/retryController');

// Импортируем утилиты из schedulerController
const { getTimezoneByCountry, computeLocalAt } = require('./controllers/schedulerController');

// --- Utilities ----------------------------------------------------------------

function computeNextRecurringAt(createdAt, timezone) {
  // Первый ребилл через 7 дней, в 23:30 локального времени пользователя
  const base = moment(createdAt).tz(timezone).add(7, 'days').hour(23).minute(30).second(0).millisecond(0);
  return base.toDate();
}

// --- Core ---------------------------------------------------------------------

async function attemptRebill(payment) {
  try {
    console.log(`🔄 Attempting rebill for payment ${payment.id}`);

    // Гибридный подход: сначала пробуем retry с существующим referenceCode
    if (payment.subscriptionReferenceCode) {
      console.log(`🔄 Trying retry with existing referenceCode: ${payment.subscriptionReferenceCode}`);
      
      try {
        const retryResult = await retrySubscription(payment.subscriptionReferenceCode);
        
        if (retryResult.success) {
          // Успех retry: отключаем дальнейшие попытки и ставим следующую дату через 7 дней
          const tz = payment.timezone || getTimezoneByCountry(payment.countryCode);
          const nextAt = computeNextRecurringAt(new Date(), tz);
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              lastAttemptAt: new Date(),
              rebillAttempts: (payment.rebillAttempts || 0) + 1,
              nextRecurringAt: nextAt,
              isRecurringActive: true,
              rebillLog: [
                ...(payment.rebillLog || []),
                {
                  status: 'success',
                  at: new Date().toISOString(),
                  stage: 'retry-success',
                  raw: retryResult,
                }
              ],
            },
          });
          console.log(`✅ Retry succeeded for ${payment.id}`);
          return true;
        } else {
          console.log(`⚠️ Retry failed for ${payment.id}: ${retryResult.error}. Falling back to new subscription.`);
        }
      } catch (retryError) {
        console.log(`⚠️ Retry error for ${payment.id}: ${retryError.message}. Falling back to new subscription.`);
      }
    }

    // Fallback: создаем новую подписку через /pay
    console.log(`🔄 Creating new subscription for payment ${payment.id}`);
    
    const payload = {
      firstName: payment.firstName,
      lastName: payment.lastName,
      email: payment.email,
      phone: payment.phone,
      countryCode: payment.countryCode,
      address: payment.address,
      postalCode: payment.postalCode,
      city: payment.city,
      cardHolder: payment.cardHolder,
      cardNumber: payment.cardNumber,
      expiry: payment.expiry,
      cvv: payment.cvv,
      plan: payment.plan,
      bid: payment.bid,
      userHash: payment.userHash,
      locale: payment.locale,
      isRecurring: true,
    };

    const response = await axios.post('http://localhost:3011/pay', payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60_000,
    });

    const ok = !!response?.data?.success;
    const isInsufficient = (() => {
      const msg = (response?.data?.errorMessage || '').toString().toLowerCase();
      const code = (response?.data?.errorCode || '').toString().toLowerCase();
      return msg.includes('insufficient') || code.includes('insufficient');
    })();

    if (ok) {
      // Успех: отключаем дальнейшие попытки и ставим следующую дату через 7 дней
      const tz = payment.timezone || getTimezoneByCountry(payment.countryCode);
      const nextAt = computeNextRecurringAt(new Date(), tz);
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          subscriptionReferenceCode: response.data.firstReferenceCode || payment.subscriptionReferenceCode,
          lastAttemptAt: new Date(),
          rebillAttempts: (payment.rebillAttempts || 0) + 1,
          nextRecurringAt: nextAt,
          isRecurringActive: true,
          rebillLog: [
            ...(payment.rebillLog || []),
            {
              status: 'success',
              at: new Date().toISOString(),
              stage: 'new-subscription-success',
              raw: response.data,
            }
          ],
        },
      });
      console.log(`✅ New subscription succeeded for ${payment.id}`);
      return true;
    }

    // Ошибка: если недостаточно средств — пробуем через 1 день, иначе прекращаем попытки
    const tz = payment.timezone || getTimezoneByCountry(payment.countryCode);
    const retryAt = moment().tz(tz).add(1, 'day').hour(23).minute(30).second(0).millisecond(0).toDate();
    const updateData = {
      lastAttemptAt: new Date(),
      rebillAttempts: (payment.rebillAttempts || 0) + 1,
      rebillLog: [
        ...(payment.rebillLog || []),
        {
          status: 'failure',
          at: new Date().toISOString(),
          stage: 'new-subscription-failure',
          error: {
            code: response?.data?.errorCode,
            message: response?.data?.errorMessage || response?.statusText,
            group: response?.data?.errorGroup,
            errors: response?.data?.errors,
          },
        }
      ],
    };
    if (isInsufficient) {
      updateData.nextRecurringAt = retryAt;
      updateData.isRecurringActive = true;
      console.warn(`⚠️ New subscription failed (insufficient funds) for ${payment.id}. Next attempt at ${retryAt.toISOString()}`);
    } else {
      updateData.nextRecurringAt = null;
      updateData.isRecurringActive = false;
      console.warn(`⛔ New subscription failed (non-retryable) for ${payment.id}. Disabling further attempts.`);
    }
    await prisma.payment.update({ where: { id: payment.id }, data: updateData });
    return false;
  } catch (error) {
    console.error(`❌ Rebill error for ${payment.id}:`, error.message);
    // Для технической ошибки — не знаем тип, повторим через 1 день
    const tz = payment.timezone || getTimezoneByCountry(payment.countryCode);
    const retryAt = moment().tz(tz).add(1, 'day').hour(23).minute(30).second(0).millisecond(0).toDate();
    await prisma.payment.update({ where: { id: payment.id }, data: {
      lastAttemptAt: new Date(),
      rebillAttempts: (payment.rebillAttempts || 0) + 1,
      nextRecurringAt: retryAt,
      isRecurringActive: true,
      rebillLog: [
        ...(payment.rebillLog || []),
        { 
          status: 'failure', 
          at: new Date().toISOString(),
          stage: 'technical-error',
          error: { message: error.message } 
        }
      ],
    }});
    return false;
  }
}

async function processRecurringPayments() {
  console.log('🕐 Scanning for due rebills...');
  const now = new Date();
  // Окно обработки: только записи, у которых nextRecurringAt в интервале [now-15m; now]
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000);
  const due = await prisma.payment.findMany({
    where: {
      isRecurringActive: true,
      nextRecurringAt: { lte: now, gt: windowStart },
    },
    orderBy: { nextRecurringAt: 'asc' },
    take: 200,
  });

  console.log(`📊 Found ${due.length} payments to process`);
  for (const p of due) {
    await attemptRebill(p);
  }
}

// --- Scheduler ----------------------------------------------------------------

let schedulerStarted = false;

function startPaymentScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  console.log('🚀 Starting recurring payment scheduler...');

  // Основной цикл: каждые 5 минут, чтобы попасть в окно 23:30–23:55
  cron.schedule('*/5 * * * *', async () => {
    await processRecurringPayments();
  });

  console.log('✅ Scheduler running. Interval: every 5 minutes');
}

// --- DB Triggers (lightweight) -----------------------------------------------

// Вспомогательная функция: вызывать при изменениях в БД (создание оплаты и т.п.)
// Можно импортировать и вызывать из контроллеров после успешной записи
async function notifyDbChanged() {
  // Лёгкий дебаунс, чтобы не спамить
  if (notifyDbChanged.lock) return;
  notifyDbChanged.lock = true;
  setTimeout(() => (notifyDbChanged.lock = false), 5_000);
  await processRecurringPayments();
}

// --- Initial backfill for existing records -----------------------------------

async function ensureNextRecurringForNewPayments() {
  // Для записей, где nextRecurringAt пуст, проставим впервые
  const candidates = await prisma.payment.findMany({
    where: { nextRecurringAt: null },
    take: 500,
  });

  for (const p of candidates) {
    const tz = p.timezone || getTimezoneByCountry(p.countryCode);
    const nextAt = computeNextRecurringAt(p.createdAt, tz);
    await prisma.payment.update({ where: { id: p.id }, data: { timezone: tz, nextRecurringAt: nextAt } });
  }
}

module.exports = {
  startPaymentScheduler,
  processRecurringPayments,
  notifyDbChanged,
  ensureNextRecurringForNewPayments,
};

// Автозапуск при прямом вызове
if (require.main === module) {
  (async () => {
    await ensureNextRecurringForNewPayments();
    startPaymentScheduler();
    await processRecurringPayments();
  })();
}
