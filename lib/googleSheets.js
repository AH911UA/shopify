const { google } = require('googleapis');

/**
 * Класс для работы с Google Sheets
 */
class GoogleSheetsManager {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = null;
    this.isInitialized = false;
    this.isDisabled = false; // Флаг для отключения Google Sheets
  }

  
  /**
   * Инициализация подключения к Google Sheets
   */
  async initialize() {
    try {
      // Проверяем наличие переменных окружения
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 
          !process.env.GOOGLE_PRIVATE_KEY || 
          !process.env.GOOGLE_SHEET_ID) {
        console.log('⚠️ Google Sheets отключен - отсутствуют переменные окружения');
        this.isDisabled = true;
        return false;
      }

      // Проверяем формат приватного ключа
      let privateKey = process.env.GOOGLE_PRIVATE_KEY;
      
      // Убираем лишние кавычки и экранирование
      privateKey = privateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      
      // Если ключ не содержит BEGIN/END маркеры, добавляем их
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
      }

      // Создаем JWT для аутентификации
      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      // Создаем экземпляр Google Sheets API
      this.sheets = google.sheets({ version: 'v4', auth });
      this.spreadsheetId = process.env.GOOGLE_SHEET_ID;

      // Проверяем доступ к таблице
      await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      this.isInitialized = true;
      console.log('✅ Google Sheets подключение установлено');
      
      return true;
    } catch (error) {
      console.error('❌ Ошибка инициализации Google Sheets:', error.message);
      console.error('🔍 Детали ошибки:', {
        hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
        hasSheetId: !!process.env.GOOGLE_SHEET_ID,
        privateKeyLength: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.length : 0
      });
      console.log('⚠️ Google Sheets будет отключен для тестирования');
      this.isDisabled = true;
      return false;
    }
  }

  /**
   * Получает данные из таблицы
   */
  async getSheetData(range = 'A:Z') {
    try {
      if (this.isDisabled) {
        console.log('⚠️ Google Sheets отключен - пропускаем получение данных');
        return [];
      }

      if (!this.isInitialized) {
        await this.initialize();
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
      });

      return response.data.values || [];
    } catch (error) {
      console.error('❌ Ошибка при получении данных:', error.message);
      return [];
    }
  }

  /**
   * Добавляет новый платеж в таблицу
   * @param {Object} paymentData - Данные платежа
   */
  async addPayment(paymentData) {
    try {
      if (this.isDisabled) {
        console.log('⚠️ Google Sheets отключен - пропускаем запись платежа');
        console.log('📊 Данные для записи:', {
          bid: paymentData.bid,
          firstName: paymentData.firstName,
          lastName: paymentData.lastName,
          plan: paymentData.plan,
          subscriptionId: paymentData.subscriptionId,
          paymentType: paymentData.paymentType
        });
        return { success: true, message: 'Google Sheets disabled' };
      }

      if (!this.isInitialized) {
        await this.initialize();
      }

      // Определяем цену согласно плану
      const planPrices = {
        test: 0.01,
        solo: 9.99,
        plus: 19.99,
        premium: 19.99
      };

      const price = planPrices[paymentData.plan] || 9.99;
      const customerName = `${paymentData.firstName || ''} ${paymentData.lastName || ''}`.trim();

      // Получаем текущие данные таблицы
      const sheetData = await this.getSheetData('B:Z'); // Changed to B:Z to match new structure
      
      // Ищем существующую запись по имени клиента (колонка E, индекс 3 в новой структуре)
      let existingRow = -1;
      for (let i = 2; i < sheetData.length; i++) {
        if (sheetData[i] && sheetData[i][3] === customerName && customerName !== '') { // Changed from [4] to [3] because Customer Name is now at index 3 (E column)
          existingRow = i;
          break;
        }
      }
      
      console.log(`🔍 Поиск строки для клиента: ${customerName}`);
      console.log(`📊 Найдена строка: ${existingRow > -1 ? existingRow + 1 : 'не найдена'}`);
      console.log(`📝 Тип платежа: ${paymentData.paymentType}`);

      if (existingRow > -1 && (paymentData.paymentType === 'second_payment' || paymentData.paymentType === 'recurring_payment')) {
        // Определяем, какой это платеж (второй или последующий)
        const currentRow = sheetData[existingRow];
        let updateRange;
        let updateData;
        
        if (paymentData.paymentType === 'second_payment') {
          // Второй платеж - обновляем колонки I, J, K
          updateRange = `I${existingRow + 1}:K${existingRow + 1}`;
          updateData = [
            [
              paymentData.price || price, // I - повторный платеж №1 (цена второго платежа)
              new Date().toISOString(), // J - дата второго платежа
              paymentData.error || 'Success' // K - статус платежа
            ]
          ];
          console.log(`✅ Второй платеж обновлен в Google Sheets (I-K) для строки ${existingRow + 1}`);
          console.log(`💰 Цена: ${paymentData.price || price}`);
          console.log(`📅 Дата: ${new Date().toISOString()}`);
          console.log(`📊 Диапазон обновления: ${updateRange}`);
          console.log(`📝 Данные для обновления:`, updateData[0]);
        } else {
          // Последующие платежи - ищем следующую свободную группу колонок
          // Формат: L-M-N (повторный платеж №2), O-P-Q (повторный платеж №3), и т.д.
          const columnGroups = [
            ['L', 'M', 'N'], // повторный платеж №2
            ['O', 'P', 'Q'], // повторный платеж №3
            ['R', 'S', 'T'], // повторный платеж №4
            ['U', 'V', 'W'], // повторный платеж №5
            ['X', 'Y', 'Z']  // повторный платеж №6
          ];
          
          let foundGroup = null;
          for (const group of columnGroups) {
            const [paymentCol, dateCol, statusCol] = group;
            const paymentColIndex = paymentCol.charCodeAt(0) - 65; // A=0, B=1, etc.
            
            if (!currentRow[paymentColIndex] || currentRow[paymentColIndex] === '') {
              foundGroup = group;
              break;
            }
          }
          
          if (foundGroup) {
            const [paymentCol, dateCol, statusCol] = foundGroup;
            updateRange = `${paymentCol}${existingRow + 1}:${statusCol}${existingRow + 1}`;
            updateData = [
              [
                paymentData.price || price, // Сумма повторного платежа
                new Date().toISOString(), // Дата повторного платежа
                paymentData.error || 'Success' // Статус (успех или ошибка)
              ]
            ];
            console.log(`✅ Повторный платеж обновлен в Google Sheets (${paymentCol}-${statusCol})`);
          } else {
            console.log('⚠️ Нет свободных колонок для записи повторного платежа');
            return { success: false, error: 'No available columns' };
          }
        }

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: updateRange,
          valueInputOption: 'RAW',
          resource: { values: updateData }
        });

        return { success: true, message: 'Payment updated' };
      } else {
        // Добавляем новую строку для первого платежа
        const newRow = [
          paymentData.bid || 'murkafix', // B - BID
          new Date().toISOString(), // C - Created Date (дата первого платежа)
          price, // D - Paid Price (сумма первого платежа)
          customerName, // E - Customer Name
          paymentData.countryCode || 'US', // F - GEO (req.body.countryCode)
          paymentData.plan || 'test', // G - SUBSCR (req.body.plan)
          paymentData.subscriptionId || '', // H - Subscription ID (req.body.subscriptionId)
          '', // I - повторный платеж №1 (пусто для первого платежа)
          '', // J - дата (пусто для первого платежа)
          paymentData.error || 'Success' // K - примечание (успех или ошибка)
        ];

        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: 'B:K',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [newRow] }
        });

        console.log('✅ Новый платеж добавлен в Google Sheets');
        console.log(`👤 Клиент: ${customerName}`);
        console.log(`🌍 GEO: ${paymentData.countryCode || 'US'}`);
        console.log(`📋 План: ${paymentData.plan || 'test'}`);
        console.log(`🆔 Subscription ID: ${paymentData.subscriptionId || ''}`);
        console.log(`📊 Данные строки:`, newRow);
        return { success: true, message: 'Payment added' };
      }
    } catch (error) {
      console.error('❌ Ошибка при записи в Google Sheets:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Инициализирует заголовки таблицы
   */
  async initializeHeaders() {
    try {
      if (this.isDisabled) {
        console.log('⚠️ Google Sheets отключен - пропускаем инициализацию заголовков');
        return { success: true, message: 'Google Sheets disabled' };
      }

      if (!this.isInitialized) {
        await this.initialize();
      }

      // Заголовки для таблицы
      const headers = [
        '', // A - пустая
        'BID', // B - BID
        'Created Date', // C - Created Date
        'Paid Price', // D - Paid Price
        'Customer Name', // E - Customer Name
        'GEO', // F - GEO
        'SUBSCR', // G - SUBSCR
        'Subscription ID', // H - Subscription ID
        'повторный платеж №1', // I - повторный платеж №1
        'дата', // J - дата
        'примечание', // K - примечание
        'повторный платеж №2', // L - повторный платеж №2
        'дата', // M - дата
        'примечание', // N - примечание
        'повторный платеж №3', // O - повторный платеж №3
        'дата', // P - дата
        'примечание', // Q - примечание
        'повторный платеж №4', // R - повторный платеж №4
        'дата', // S - дата
        'примечание', // T - примечание
        'повторный платеж №5', // U - повторный платеж №5
        'дата', // V - дата
        'примечание', // W - примечание
        'повторный платеж №6', // X - повторный платеж №6
        'дата', // Y - дата
        'примечание' // Z - примечание
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'A1:Z1',
        valueInputOption: 'RAW',
        resource: { values: [headers] }
      });

      console.log('✅ Заголовки таблицы инициализированы');
      return { success: true, message: 'Headers initialized' };
    } catch (error) {
      console.error('❌ Ошибка при инициализации заголовков:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Синхронизирует все платежи из БД в Google Sheets
   */
  async syncAllPayments() {
    try {
      if (this.isDisabled) {
        console.log('⚠️ Google Sheets отключен - пропускаем синхронизацию');
        return { success: true, message: 'Google Sheets disabled' };
      }

      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('🔄 Начинаем синхронизацию всех платежей...');
      
      // Получаем все платежи из БД
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const payments = await prisma.payment.findMany({
        orderBy: {
          createdAt: 'asc'
        }
      });
      
      console.log(`📊 Найдено ${payments.length} платежей в БД`);
      
      // Очищаем таблицу (начиная с 3-й строки)
      const clearRange = 'B3:Z1000';
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: clearRange
      });
      
      // Группируем платежи по пользователю
      const groupedPayments = {};
      payments.forEach(payment => {
        const userKey = payment.userHash || payment.email;
        if (!groupedPayments[userKey]) {
          groupedPayments[userKey] = [];
        }
        groupedPayments[userKey].push(payment);
      });
      
      const rowsToInsert = [];
      
      // Подготавливаем данные для записи
      for (const [userKey, userPayments] of Object.entries(groupedPayments)) {
        const firstPayment = userPayments[0];
        const customerName = `${firstPayment.firstName || ''} ${firstPayment.lastName || ''}`.trim();
        
        // Определяем цену
        const planPrices = {
          test: 0.01,
          solo: 9.99,
          plus: 19.99,
          premium: 19.99
        };
        const price = planPrices[firstPayment.plan] || 9.99;
        
        // Создаем строку с основной информацией
        const row = [
          firstPayment.bid || 'murkafix', // B - BID
          firstPayment.createdAt.toISOString(), // C - дата
          price, // D - цена первой оплаты
          customerName, // E - имя клиента
          firstPayment.countryCode || 'US', // F - GEO
          firstPayment.plan || 'test', // G - SUBSCR
          firstPayment.subscriptionReferenceCode || '', // H - Subscription ID
          '', // I - повторный платеж №1 (пусто для первого платежа)
          '', // J - дата (пусто для первого платежа)
          'Success' // K - примечание (успех для первого платежа)
        ];
        
        // Добавляем повторные платежи в правильные колонки
        for (let i = 1; i <= userPayments.length - 1; i++) {
          const payment = userPayments[i];
          const paymentPrice = planPrices[payment.plan] || 9.99;
          
          // Обновляем колонки I, J, K для второго платежа
          if (i === 1) {
            row[8] = paymentPrice; // I - повторный платеж №1
            row[9] = payment.createdAt.toISOString(); // J - дата
            row[10] = 'Success'; // K - статус
          }
          // Для последующих платежей можно добавить логику для колонок L-N, O-Q и т.д.
        }
        
        rowsToInsert.push(row);
      }
      
      if (rowsToInsert.length > 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'B3',
          valueInputOption: 'RAW',
          resource: { values: rowsToInsert }
        });
      }
      
      console.log(`✅ Синхронизация завершена. Записано ${rowsToInsert.length} строк`);
      
      return { success: true, rowsCount: rowsToInsert.length };
    } catch (error) {
      console.error('❌ Ошибка при синхронизации:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Создаем экземпляр менеджера
const googleSheetsManager = new GoogleSheetsManager();

/**
 * Добавляет новую подписку в Google Sheets
 */
async function addNewSubscriptionToSheet(subscriptionData) {
  try {
    const result = await googleSheetsManager.addPayment(subscriptionData);
    return result;
  } catch (error) {
    console.error('❌ Ошибка при добавлении подписки:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Синхронизирует все платежи из БД в Google Sheets
 */
async function syncAllPaymentsToSheets() {
  try {
    const result = await googleSheetsManager.syncAllPayments();
    return result;
  } catch (error) {
    console.error('❌ Ошибка при синхронизации:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  addNewSubscriptionToSheet,
  syncAllPaymentsToSheets,
  googleSheetsManager,
  initializeHeaders: () => googleSheetsManager.initializeHeaders()
}; 