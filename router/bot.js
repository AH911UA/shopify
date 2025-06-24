/** @format */

const express = require('express');
const router = express.Router();
const { sendMessage } = require('../controllers/botController');

router.post('/sendMessage', sendMessage);

module.exports = router;
