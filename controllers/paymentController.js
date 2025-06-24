const axios = require('axios');
const { sendPaymentData } = require('./botController');

const API_KEY = process.env.IYZIPAY_API_KEY;
const SECRET_KEY = process.env.IYZIPAY_SECRET_KEY;


const PLAN_REFERENCE_CODES = {
  solo: 'decef24c-4ee5-4407-94bf-6c64b096660f',
  plus: '438fb589-63da-411c-9802-09f8bdc0a8ae',
  // plus: '60c70d55-edec-4d45-89f4-67d322f98834',
  premium: 'fd5fc9cb-06f7-4079-92c7-5d25adc0f6b4'
};

exports.processPayment = async (req, res) => {
  console.log('RAW BODY:', req.body);
  const {
    firstName, lastName, address, postalCode, city, countryCode,
    email, phone, cardHolder, cardNumber, expiry, cvv, price, fb, bid, plan
  } = req.body;

  console.log('plan', plan);


  const [expireMonth, expireYear] = expiry.split('/');

  const referenceCode = PLAN_REFERENCE_CODES[plan] || PLAN_REFERENCE_CODES['solo'];
  // console.log('API_KEY:', API_KEY, 'SECRET_KEY:', SECRET_KEY);
  console.log('referenceCode', referenceCode);
  
  try {
    const response = await axios.post(
      'https://api.iyzipay.com/v2/subscription/subscribers',
      {
        conversationId: '123456789',
        locale: 'en',
        pricingPlanReferenceCode: referenceCode,
        subscriber: {
          name: firstName,
          surname: lastName,
          email: email,
          gsmNumber: phone
        },
        paymentCard: {
          cardHolderName: cardHolder,
          cardNumber: cardNumber,
          expireMonth: expireMonth,
          expireYear: '20' + expireYear,
          cvc: cvv
        },
        billingAddress: {
          contactName: `${firstName} ${lastName}`,
          city,
          country: countryCode,
          address,
          zipCode: postalCode
        }
      },
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(API_KEY + ':' + SECRET_KEY).toString('base64'),
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status !== 'success') {
      return res.status(400).send(response.data.errorMessage || 'Subscription failed');
    }

    await sendPaymentData(req.body);

    res.redirect('/payment-success');
  } catch (err) {
    if (err.response && err.response.data) {
      console.error('Iyzico error:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Iyzico error:', err);
    }
    const msg = err.response && err.response.data && err.response.data.errorMessage
      ? err.response.data.errorMessage
      : (err.message || 'Subscription failed');
    return res.status(400).send(msg);
  }
};
