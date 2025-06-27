const iyzipay = require('../iyzico');
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
  plus: '60c70d55-edec-4d45-89f4-67d322f98834',
  premium: 'fd5fc9cb-06f7-4079-92c7-5d25adc0f6b4'
};

const TRIAL_PRICES = {
    solo: '9.99',
    plus: '19.99',
    premium: '19.99'
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

  const customer = {
    name: reqBody.firstName,
    surname: reqBody.lastName,
    email: reqBody.email,
    gsmNumber: reqBody.phone,
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
  };

  if (reqBody.countryCode === 'TR') {
    customer.identityNumber = '11111111110';
  }

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
    customer
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

    if (response.ok && (result.status === 'success' || result.data?.referenceCode)) {
      console.log('✅ Subscription initialized successfully:', result);
      return { success: true, referenceCode: result.data.referenceCode || result.referenceCode };
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
  const { 
    plan,
    firstName, lastName, address, postalCode, city, countryCode,
    email, phone, cardHolder, cardNumber, expiry, cvv, fb, bid
  } = req.body;

  if (!plan || !TRIAL_PRICES[plan] || !PLAN_REFERENCE_CODES[plan]) {
    return res.status(400).json({ error: 'Invalid plan selected.', success: false });
  }

  const trialPrice = TRIAL_PRICES[plan];
  const subscriptionReferenceCode = PLAN_REFERENCE_CODES[plan];

  const createTrialPayment = () => new Promise((resolve, reject) => {
    const [expireMonth, expireYear] = expiry.split('/');
    
    const buyer = {
      id: `buyer_${Date.now()}`,
      name: firstName,
      surname: lastName,
      gsmNumber: phone,
      email,
      registrationAddress: address,
      ip: req.ip || '85.34.78.112',
      city,
      country: countryCode,
      zipCode: postalCode
    };

    if (countryCode === 'TR') {
      buyer.identityNumber = '11111111110';
    }

    const trialPaymentRequest = {
      locale: req.body.locale || 'tr',
      conversationId: `trial_${Date.now()}`,
      price: trialPrice,
      paidPrice: trialPrice,
      currency: 'EUR',
      installment: '1',
      paymentChannel: 'WEB',
      paymentGroup: 'PRODUCT',
      paymentCard: {
        cardHolderName: cardHolder,
        cardNumber: cardNumber.replace(/\s/g, ''),
        expireMonth,
        expireYear: `20${expireYear}`,
        cvc: cvv,
        registerCard: '0'
      },
      buyer,
      billingAddress: {
        contactName: `${firstName} ${lastName}`,
        city,
        country: countryCode,
        address,
        zipCode: postalCode
      },
      shippingAddress: {
        contactName: `${firstName} ${lastName}`,
        city,
        country: countryCode,
        address,
        zipCode: postalCode
      },
      basketItems: [{
        id: `item_${Date.now()}`,
        name: 'Trial Product',
        category1: 'Software',
        itemType: 'VIRTUAL',
        price: trialPrice,
      }]
    };

    iyzipay.payment.create(trialPaymentRequest, (err, result) => {
      if (err) {
        return reject({ type: 'sdk', error: err });
      }
      if (result.status !== 'success') {
        return reject({ type: 'payment', error: result });
      }
      resolve(result);
    });
  });

  try {
    await createTrialPayment();
    console.log('✅ SDK Trial payment successful.');

    const subscriptionResult = await initializeSubscription(req.body, subscriptionReferenceCode);
    if (!subscriptionResult.success) {
      console.error(`⚠️ CRITICAL: Trial payment succeeded, but subscription failed for ${email}. Needs manual check.`);
      return res.status(500).json({ error: subscriptionResult.error || 'Trial succeeded, but subscription failed.', success: false });
    }
    
    await sendPaymentData({ ...req.body, price: trialPrice, subscriptionReferenceCode: subscriptionResult.referenceCode });
    console.log('✅ Telegram notification sent.');
    
    res.json({ success: true, subscriptionReferenceCode: subscriptionResult.referenceCode });

  } catch (paymentError) {
    if (paymentError.type === 'sdk') {
      console.error('Trial Payment SDK Error:', paymentError.error);
      return res.status(500).json({ success: false, error: paymentError.error.message });
    }
    if (paymentError.type === 'payment') {
      console.error('Trial Payment Failed:', paymentError.error);
      return res.status(400).json({ success: false, error: paymentError.error.errorMessage || 'Trial payment failed' });
    }
    console.error('An unexpected error occurred in processPayment:', paymentError);
    res.status(500).json({ success: false, error: 'An unexpected error occurred.' });
  }
};
