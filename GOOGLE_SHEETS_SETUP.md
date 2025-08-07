# 🔧 Настройка Google Sheets

## Проблема
В данный момент Google Sheets отключен из-за отсутствия настроенных переменных окружения.

## Решение

### 1. Создание Google Service Account

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите Google Sheets API:
   - Перейдите в "APIs & Services" > "Library"
   - Найдите "Google Sheets API" и включите его

### 2. Создание Service Account

1. Перейдите в "APIs & Services" > "Credentials"
2. Нажмите "Create Credentials" > "Service Account"
3. Заполните форму:
   - Name: `shopify-payments`
   - Description: `Service account for Shopify payments`
4. Нажмите "Create and Continue"
5. Пропустите роли (нажмите "Continue")
6. Нажмите "Done"

### 3. Создание ключей

1. В списке Service Accounts найдите созданный аккаунт
2. Нажмите на email (например: `shopify-payments@project-id.iam.gserviceaccount.com`)
3. Перейдите на вкладку "Keys"
4. Нажмите "Add Key" > "Create new key"
5. Выберите "JSON" и нажмите "Create"
6. Скачается файл с ключами

### 4. Настройка переменных окружения

Откройте файл `.env` и добавьте:

```env
# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=shopify-payments@your-project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----"
GOOGLE_SHEET_ID=your-spreadsheet-id
```

**Важно:** 
- Скопируйте `client_email` из JSON файла в `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- Скопируйте `private_key` из JSON файла в `GOOGLE_PRIVATE_KEY` (с кавычками)
- Получите ID таблицы из URL: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`

### 5. Создание Google Sheets таблицы

1. Создайте новую Google Sheets таблицу
2. **Заголовки будут созданы автоматически** при первом запуске приложения
3. Скопируйте ID таблицы из URL
4. Поделитесь таблицей с email сервисного аккаунта (с правами редактора)

### 6. Тестирование

После настройки запустите:

```bash
node test-env.js
```

Должно показать:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL: ✅ Настроен
GOOGLE_PRIVATE_KEY: ✅ Настроен  
GOOGLE_SHEET_ID: ✅ Настроен
```

### 7. Запуск теста

```bash
node quick-test.js
```

Теперь данные должны записываться в Google Sheets!

## Структура таблицы

| Колонка | Описание | Пример |
|---------|----------|--------|
| A | (пустая) | - |
| B | BID | murkafix |
| C | Created Date | 2024-01-15T10:30:00.000Z |
| D | Paid Price | 0.01 |
| E | Customer Name | John Doe |
| F | GEO | US |
| G | SUBSCR | solo |
| H | Subscription ID | sub_1705312200000 |
| I | повторный платеж №1 | 1.00 |
| J | дата | 2024-01-22T10:30:00.000Z |
| K | примечание | Success |
| L | повторный платеж №2 | 1.00 |
| M | дата | 2024-01-29T10:30:00.000Z |
| N | примечание | Success |
| O-Z | повторные платежи №3-6 | (дата, примечание) |

## Логика записи данных

- **Первый платеж**: создает новую строку с данными в колонках B-H
- **Второй платеж**: обновляет ту же строку, добавляя данные в колонки I-K
- **Повторные платежи**: добавляются в следующие группы колонок (L-N, O-Q, R-T, U-W, X-Z)

## Устранение проблем

### Ошибка "DECODER routines::unsupported"
- Проверьте формат приватного ключа
- Убедитесь, что ключ обернут в кавычки в .env файле
- Проверьте, что нет лишних символов

### Ошибка "Permission denied"
- Поделитесь таблицей с email сервисного аккаунта
- Убедитесь, что у аккаунта есть права редактора

### Ошибка "API not enabled"
- Включите Google Sheets API в Google Cloud Console

### Данные не записываются
- Проверьте, что все переменные окружения настроены
- Убедитесь, что таблица доступна для сервисного аккаунта
- Проверьте логи сервера на наличие ошибок 