const router = require("express").Router()
const MainController = require("../controllers/MainController");
const paymentController = require('../controllers/paymentController');

router.get("/", MainController.index);
router.post('/pay', paymentController.processPayment);
router.post('/set-lang', (req, res) => {
  res.cookie('lang', req.body.lang, { maxAge: 900000, httpOnly: false });
  res.sendStatus(200);
});

module.exports = router;
