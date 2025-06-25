const axios = require('axios');
const { sendPaymentData } = require('./botController');
const crypto = require('crypto');
const fetch = require('node-fetch');

const API_KEY = process.env.IYZIPAY_API_KEY.trim();
const SECRET_KEY = process.env.IYZIPAY_SECRET_KEY.trim();

console.log('API_KEY:', API_KEY);
console.log('SECRET_KEY:', SECRET_KEY);

const apiKey = API_KEY;
const secretKey = SECRET_KEY;
const baseUrl = 'https://api.iyzipay.com';

const PLAN_REFERENCE_CODES = {
  solo: 'decef24c-4ee5-4407-94bf-6c64b096660f',
  plus: '438fb589-63da-411c-9802-09f8bdc0a8ae',
  premium: 'fd5fc9cb-06f7-4079-92c7-5d25adc0f6b4'
};

function generateHmacSignature(secretKey, randomString, path, payload) {
  const dataToSign = randomString + path + JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secretKey)
    .update(dataToSign, 'utf8')
    .digest('base64');
}


async function initializeSubscription(reqBody, referenceCode) {
  const path = '/v2/subscription/initialize';
  const url = `${baseUrl}${path}`;
  const randomString = crypto.randomBytes(8).toString('hex');
  const conversationId = `sub_${Date.now()}`;

  const payload = {
    locale: 'TR',
    conversationId,
    pricingPlanReferenceCode: referenceCode,
    subscriptionInitialStatus: 'ACTIVE',
    paymentCard: {
      cardHolderName: reqBody.cardHolder,
      cardNumber: reqBody.cardNumber.replace(/\s/g, ''),
      expireMonth: reqBody.expiry.split('/')[0],
      expireYear: '20' + reqBody.expiry.split('/')[1],
      cvc: reqBody.cvv,
      registerConsumerCard: true,
    },
    name: reqBody.firstName,
    surname: reqBody.lastName,
    email: reqBody.email,
    gsmNumber: '+905555555555',
    buyer: {
      identityNumber: '10000000146',
    },
    shippingAddress: {
      contactName: `${reqBody.firstName} ${reqBody.lastName}`,
      city: reqBody.city,
      country: 'TR',
      address: reqBody.address,
      zipCode: reqBody.postalCode,
    },
    billingAddress: {
      contactName: `${reqBody.firstName} ${reqBody.lastName}`,
      city: reqBody.city,
      country: 'TR',
      address: reqBody.address,
      zipCode: reqBody.postalCode,
    },
  };

  const signature = generateHmacSignature(secretKey, randomString, path, payload);
  const authRaw = `apiKey:${apiKey}&randomKey:${randomString}&signature:${signature}`;
  const base64Auth = Buffer.from(authRaw, 'utf8').toString('base64');
  const authorization = `IYZWSv2 ${base64Auth}`;

  const headers = {
    'Authorization': authorization,
    'Content-Type': 'application/json',
    'x-iyzi-rnd': randomString,
  };

  console.log('URL:', url);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('Headers:', headers);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && result.status === 'success') {
      console.log('✅ Подписка успешно инициализирована:', result);
      return result.data.referenceCode;
    } else {
      console.error('❌ Ошибка инициализации подписки:', result);
      return null;
    }
  } catch (error) {
    console.error('❌ Ошибка выполнения запроса:', error);
    return null;
  }
}

const mockUser = {
  cardHolder: 'John Doe',
  cardNumber: '4040380383497260',
  expiry: '05/28',
  cvv: '722',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '+905555555555',
  city: 'Istanbul',
  countryCode: 'TR',
  address: 'Test Street 123',
  postalCode: '34000',
};

initializeSubscription(mockUser, '438fb589-63da-411c-9802-09f8bdc0a8ae');




// // 2. Исправления в основной функции
// async function initializeSubscription(reqBody, referenceCode) {
//   const url = `${baseUrl}/v2/subscription/initialize`;
//   const randomString = 'shh0o3da'; // Используем вашу строку для теста
//   const conversationId = `sub_${Date.now()}`;

//   // ... (ваш код для сборки payload остается без изменений)

//   const payload = {
//     "locale": "TR",
//     "conversationId": "sub_1234567890",
//     "pricingPlanReferenceCode": "438fb589-63da-411c-9802-09f8bdc0a8ae",
//     "subscriptionInitialStatus": "ACTIVE",
//     "paymentCard": {
//       "cardHolderName": "John Doe",
//       "cardNumber": "5528790000000008",
//       "expireMonth": "05",
//       "expireYear": "2028",
//       "cvc": "722",
//       "registerConsumerCard": true
//     },
//     "name": "John",
//     "surname": "Doe",
//     "email": "john.doe@example.com",
//     "gsmNumber": "+905555555555",
//     "identityNumber": "10000000146",
//     "shippingAddress": {
//       "contactName": "John Doe",
//       "city": "Istanbul",
//       "country": "TR",
//       "address": "Test address",
//       "zipCode": "34000"
//     },
//     "billingAddress": {
//       "contactName": "John Doe",
//       "city": "Istanbul",
//       "country": "TR",
//       "address": "Test address",
//       "zipCode": "34000"
//     }
//   }

//   // const payload = {
//   //     locale: 'TR',
//   //     conversationId: conversationId,
//   //     pricingPlanReferenceCode: '438fb589-63da-411c-9802-09f8bdc0a8ae',
//   //     subscriptionInitialStatus: 'ACTIVE',
//   //     paymentCard: {
//   //         cardHolderName: "",
//   //         cardNumber: reqBody.cardNumber.replaceAll(" ", ""),
//   //         expireMonth: reqBody.expiry.split('/')[0],
//   //         expireYear: '20' + reqBody.expiry.split('/')[1],
//   //         cvc: reqBody.cvv,
//   //         registerConsumerCard: true
//   //     },
//   //     name: reqBody.firstName,
//   //     surname: reqBody.lastName,
//   //     email: reqBody.email,
//   //     gsmNumber: '+905555555555',
//   //           identityNumber: '11111111110',
//   //     shippingAddress: {
//   //         contactName: `${reqBody.firstName} ${reqBody.lastName}`,
//   //         city: reqBody.city,
//   //         country: reqBody.countryCode,
//   //         address: reqBody.address,
//   //         zipCode: reqBody.postalCode
//   //     },
//   //     billingAddress: {
//   //         contactName: `${reqBody.firstName} ${reqBody.lastName}`,
//   //         city: reqBody.city,
//   //         country: reqBody.countryCode,
//   //         address: reqBody.address,
//   //         zipCode: reqBody.postalCode
//   //     }
//   // };

//   // 3. Формируем правильный заголовок с 'IYZWSv2' и передаем правильные аргументы в функцию подписи
//   const authorization = `IYZWSv2 ${apiKey}:${generateHmacSignature(secretKey, randomString, payload)}`;

//   console.log('URL:', url);
//   console.log('Payload:', JSON.stringify(payload, null, 2)); // (улучшил логирование)
//   console.log('Headers:', JSON.stringify({ // (улучшил логирование)
//       'Authorization': authorization,
//       'Content-Type': 'application/json',
//       'x-iyzi-rnd': randomString
//   }, null, 2));

//   try {
//       const response = await fetch(url, {
//           method: 'POST',
//           headers: {
//               'Authorization': authorization,
//               'Content-Type': 'application/json',
//               'x-iyzi-rnd': randomString
//           },
//           body: JSON.stringify(payload, null, 0)
//       });

//       const result = await response.json();
//       if (response.ok && result.status === 'success') { // Добавил проверку response.ok
//           console.log('Подписка инициализирована:', result); // Логируем весь ответ
//           return result.data.referenceCode;
//       } else {
//           console.error('Ошибка инициализации:', result);
//           return null;
//       }
//   } catch (error) {
//       console.error('Ошибка запроса:', error);
//       return null;
//   }
// }

// Активация подписки
// async function activateSubscription(subscriptionReferenceCode) {
//   const url = `${baseUrl}/v2/subscription/subscriptions/${subscriptionReferenceCode}/activate`;
//   const randomString = Math.random().toString(36).substring(2, 10); // 8 символов
//   const conversationId = `act_${Date.now()}`;

//   const payload = {
//       subscriptionReferenceCode,
//       locale: 'TR',
//       conversationId
//   };
//   const uri = `/v2/subscription/subscriptions/${subscriptionReferenceCode}/activate`;
//   const authorization = `IYZWS ${apiKey}:${generateHmacSignature(apiKey, secretKey, randomString, uri, payload)}`;

//   try {
//       const response = await fetch(url, {
//           method: 'POST',
//           headers: {
//               'Authorization': authorization,
//               'Content-Type': 'application/json',
//               'x-iyzi-rnd': randomString
//           },
//           body: JSON.stringify(payload, null, 0)
//       });

//       const result = await response.json();
//       if (result.status === 'success') {
//           console.log('Подписка успешно активирована!');
//           return true;
//       } else {
//           console.error('Ошибка активации:', result);
//           return false;
//       }
//   } catch (error) {
//       console.error('Ошибка запроса:', error);
//       return false;
//   }
// }

exports.processPayment = async (req, res) => {
  const { plan } = req.body;
  const referenceCode = PLAN_REFERENCE_CODES[plan] || PLAN_REFERENCE_CODES['solo'];

  // Инициализация подписки
  // const subscriptionReferenceCode = await initializeSubscription(req.body, referenceCode);
  // if (!subscriptionReferenceCode) {
  //     return res.status(500).json({ error: 'Ошибка создания подписки' });
  // }

  // Если всё ок — возвращаем успех и код подписки
  res.json({ success: true, subscriptionReferenceCode });
};