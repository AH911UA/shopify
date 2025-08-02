const express = require('express');
const router = express.Router();

router.use(express.json());

router.post('/webhooks/iyzico', (req, res) => {
  console.log('Iyzico webhook received:', req.body);
  res.status(200).send('OK');
});

router.get('/webhooks/iyzico', (req, res) => {

    res.status(200).send('OK');
  });

module.exports = router; 