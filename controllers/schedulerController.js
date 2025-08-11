const prisma = require('../lib/prisma');
const moment = require('moment-timezone');

function getTimezoneByCountry(countryCode) {
  const timezoneMap = {
    US: 'America/New_York',
    RU: 'Europe/Moscow',
    UA: 'Europe/Kiev',
    TR: 'Europe/Istanbul',
    GB: 'Europe/London',
    DE: 'Europe/Berlin',
    FR: 'Europe/Paris',
    IT: 'Europe/Rome',
    ES: 'Europe/Madrid',
    PL: 'Europe/Warsaw',
    RO: 'Europe/Bucharest',
    NL: 'Europe/Amsterdam',
    PT: 'Europe/Lisbon',
    SA: 'Asia/Riyadh',
    ID: 'Asia/Jakarta',
    TH: 'Asia/Bangkok',
    VI: 'Asia/Ho_Chi_Minh',
    JA: 'Asia/Tokyo',
    KO: 'Asia/Seoul',
    ZH: 'Asia/Shanghai',
    HE: 'Asia/Jerusalem',
    HI: 'Asia/Kolkata',
    MX: 'America/Mexico_City',
  };
  return timezoneMap[(countryCode || '').toUpperCase()] || 'UTC';
}

function computeLocalAt(date, timezone, daysToAdd) {
  return moment(date).tz(timezone).add(daysToAdd, 'days').hour(23).minute(30).second(0).millisecond(0).toDate();
}

async function ensureNextRecurringForNewPayments() {
  try {
    // Получаем все платежи, которые еще не имеют nextRecurringAt
    const payments = await prisma.payment.findMany({
      where: {
        subscriptionReferenceCode: { not: '' },
        nextRecurringAt: null,
        isRecurringActive: true
      }
    });

    console.log(`📅 Setting next recurring dates for ${payments.length} new payments`);

    for (const payment of payments) {
      const tz = payment.timezone || getTimezoneByCountry(payment.countryCode);
      const nextAt = computeLocalAt(new Date(), tz, 7);

      await prisma.payment.update({
        where: { id: payment.id },
        data: { nextRecurringAt: nextAt }
      });

      console.log(`✅ Set next recurring for payment ${payment.id}: ${nextAt.toISOString()}`);
    }

    console.log(`✅ Completed setting next recurring dates for ${payments.length} payments`);
  } catch (error) {
    console.error('❌ Error setting next recurring dates:', error);
  }
}

async function notifyDbChanged() {
  // Эта функция может быть использована для уведомления других частей системы
  // о том, что база данных изменилась
  console.log('🔄 Database changed notification sent');
}

module.exports = {
  ensureNextRecurringForNewPayments,
  notifyDbChanged,
  getTimezoneByCountry,
  computeLocalAt
};
