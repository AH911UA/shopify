const { sendPaymentData, sendFailedPaymentData, sendPaymentFirstData } = require('./botController');
const crypto = require('crypto');
const fetch = require('node-fetch');

const apiKey = process.env.IYZIPAY_API_KEY.trim();
const secretKey = process.env.IYZIPAY_SECRET_KEY.trim();
const baseUrl = 'https://api.iyzipay.com';

const TRIAL_PLAN_REFERENCE_CODES = {
  test: '55260fad-4ab7-4032-ba38-01a490f8eaea',
  solo: '5cbee644-0874-44ba-835e-4f8430dc8599',
  plus: '3d1808da-a6a7-44e9-a208-50015029eec6',
  premium: 'fea516fc-4bf7-4f7a-9118-82fa924b20f5'
};

const PLAN_REFERENCE_CODES = {
  test: '8d31206c-faf6-4e8c-9351-73ec1efb3e74',
  solo: 'a7c2b5b4-36a2-4166-8674-5552108d2bdb',
  plus: 'f9415f0e-8e35-4d8c-b680-db0332fa7fbb',
  premium: '63e38e28-7971-473c-90c9-6ce169861aa3'
};

function generateRandomDigits(length) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10);
    }
    return result;
}

function generateRandomLetters(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateIdentityNumber(countryCode) {
    if (!countryCode) return undefined;

    switch (countryCode.toUpperCase()) {
        case 'SA':
            return `3${generateRandomDigits(14)}`;
        case 'IT':
            return generateRandomDigits(11);
        case 'FR':
            return generateRandomDigits(13);
        case 'ES':
            return `${generateRandomLetters(1)}${generateRandomDigits(7)}${generateRandomLetters(1)}`;
        case 'GB':
            return generateRandomDigits(10);
        case 'TR':
            return `${Math.floor(Math.random() * 9) + 1}${generateRandomDigits(10)}`;
        case 'DE':
            return generateRandomDigits(11);
        case 'HE':
            return generateRandomDigits(9);
        case 'HI':
            return `${generateRandomLetters(5)}${generateRandomDigits(4)}${generateRandomLetters(1)}`;
        case 'ID':
            return generateRandomDigits(15);
        case 'JA':
            return generateRandomDigits(12);
        case 'KO':
            return generateRandomDigits(10);
        case 'NL':
            return `NL${generateRandomDigits(9)}B${generateRandomDigits(2)}`;
        case 'PL':
            return generateRandomDigits(10);
        case 'PT':
            return generateRandomDigits(9);
        case 'RO':
            return generateRandomDigits(13);
        case 'RU':
            return generateRandomDigits(12);
        case 'TH':
            return generateRandomDigits(13);
        case 'UK':
            return generateRandomDigits(10);
        case 'VI':
            return generateRandomDigits(10);
        case 'ZH':
            return `${generateRandomDigits(17)}${Math.random() > 0.5 ? 'X' : generateRandomDigits(1)}`;
        default:
            return undefined;
    }
}

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

  const identityNumber = generateIdentityNumber(reqBody.countryCode);
  if (identityNumber) {
    customer.identityNumber = identityNumber;
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
      return {
        success: true,
        referenceCode: result.data.referenceCode || result.referenceCode,
        customerReferenceCode: result.data?.customerReferenceCode
      };
    } else {
      console.error('❌ Error initializing subscription:', result);
      return { success: false, error: result.errorMessage || 'An unknown error occurred' };
    }
  } catch (error) {
    console.error('❌ Error executing request:', error);
    return { success: false, error: error.message };
  } finally {
    if (typeof response !== 'undefined') {
      console.log('initializeSubscription finally response:', response);
    }
  }
}

async function cancelSubscription(subscriptionReferenceCode) {
  const path = `/v2/subscription/subscriptions/${subscriptionReferenceCode}/cancel`;
  const url = `${baseUrl}${path}`;
  const randomString = crypto.randomBytes(8).toString('hex');
  const payload = { reason: "Trial completed" };

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
      console.log('✅ Subscription cancelled:', result);
      return { success: true };
    } else {
      console.error('❌ Error cancelling subscription:', result);
      return { success: false, error: result.errorMessage || 'Unknown error' };
    }
  } catch (error) {
    console.error('❌ Error executing cancel request:', error);
    return { success: false, error: error.message };
  }
}

exports.processPayment = async (req, res) => {
  try {
    const firstSub = await initializeSubscription(req.body, TRIAL_PLAN_REFERENCE_CODES[req.body.plan]);
    if (!firstSub.success) {
      await sendFailedPaymentData({ ...req.body, price: '1.00', subscriptionReferenceCode: '' }, { type: 'subscription', error: firstSub.error });
      return res.status(400).json({ success: false, error: firstSub.error || 'Не удалось создать первую подписку' });
    }
    const firstReferenceCode = firstSub.referenceCode;
    let customerReferenceCode = firstSub.customerReferenceCode;
    if (!customerReferenceCode) {
      return res.status(500).json({ success: false, error: 'Не удалось получить customerReferenceCode из первой подписки' });
    }

    await sendPaymentFirstData({ ...req.body, subscriptionReferenceCode: firstReferenceCode });

    const cancelResult = await cancelSubscription(firstReferenceCode);
    if (!cancelResult.success) {
      return res.status(500).json({ success: false, error: 'Первая подписка создана, но не удалось отменить: ' + (cancelResult.error || '') });
    }

    await sleep(2000);

    const secondSubPayload = {
      ...req.body,
      customer: { referenceCode: customerReferenceCode }
    };
    const secondSub = await initializeSubscription(secondSubPayload, PLAN_REFERENCE_CODES[req.body.plan]);
    if (!secondSub.success) {
      return res.status(500).json({ success: false, error: 'Вторая подписка не создана: ' + (secondSub.error || '') });
    }

    await sendPaymentData({ ...req.body, price: '1.00', subscriptionReferenceCode: secondSub.referenceCode });
    res.json({ success: true, firstReferenceCode, secondReferenceCode: secondSub.referenceCode });
  } catch (e) {
    console.error('processDoubleSubscription error:', e);
    res.status(500).json({ success: false, error: e.message || 'Unknown error' });
  }
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
