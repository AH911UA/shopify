const express = require('express');
const router = express.Router();

// Для парсинга JSON тела запроса
router.use(express.json());

// Готовый endpoint для webhook-уведомлений от iyzico
router.post('/webhooks/iyzico', (req, res) => {
  console.log('Iyzico webhook received:', req.body);
  // Здесь можно добавить обработку события (например, обновление статуса подписки)
  res.status(200).send('OK');
});

router.get('/webhooks/iyzico', (req, res) => {
    console.log('Iyzico webhook received:', req.body);
    // Здесь можно добавить обработку события (например, обновление статуса подписки)
    res.status(200).send('OK');
  });

module.exports = router; 