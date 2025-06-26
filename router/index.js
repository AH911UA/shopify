const router = require("express").Router()
const MainController = require("../controllers/MainController");
const paymentController = require('../controllers/paymentController');
const webhookController = require('../controllers/webhookController');

router.get("/", MainController.index);
router.post('/pay', paymentController.processPayment);
router.get('/payment-success', (req, res) => {
    res.render('payment-success', {
        locale: req.cookies.lang || 'en',
        fb: process.env.FB_PIXEL_ID,
        price: '0.00'
    });
});
router.post('/set-lang', (req, res) => {
  res.cookie('lang', req.body.lang, { maxAge: 900000, httpOnly: false });
  res.sendStatus(200);
});
router.use('/', webhookController);

module.exports = router;
