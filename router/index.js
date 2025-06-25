const router = require("express").Router()
const MainController = require("../controllers/MainController");
const paymentController = require('../controllers/paymentController');
const webhookController = require('../controllers/webhookController');

router.get("/", MainController.index);
router.post('/pay', paymentController.processPayment);
router.post('/set-lang', (req, res) => {
  res.cookie('lang', req.body.lang, { maxAge: 900000, httpOnly: false });
  res.sendStatus(200);
});
router.use('/', webhookController);

module.exports = router;
