const router = require("express").Router();
const MainController = require("../controllers/MainController");
const paymentController = require("../controllers/paymentController");
const webhookController = require("../controllers/webhookController");
const SubscriptionController = require("../controllers/SubscriptionController");
const DataTableController = require("../controllers/dataTableController");

// Middleware для агрессивного отключения CORS
const noCors = (req, res, next) => {
  const origin = req.headers.origin;
  res.header("Access-Control-Allow-Origin", origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Expose-Headers", "*");
  next();
};

// Применяем middleware ко всем маршрутам
router.use(noCors);

router.get("/", MainController.index);
router.post("/pay", paymentController.processPayment);

// Обработчик OPTIONS запросов для всех маршрутов
router.options(/.*/, (req, res) => {
  const origin = req.headers.origin;
  res.header("Access-Control-Allow-Origin", origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Expose-Headers", "*");
  res.sendStatus(200);
});

router.get("/api/payments/user/:userHash", async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const origin = req.headers.origin || req.headers.referer || "unknown";

    console.log("userAgent:", userAgent);
    console.log(
      `API Request - IP: ${ip}, Origin: ${origin}, UserHash: ${req.params.userHash}`
    );

    const payments = await SubscriptionController.getPaymentsByUserHash(
      req.params.userHash
    );

    if (!payments) {
      return res.sendStatus(400);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("API Error:", error);
    return res.json([]);
  }
});

router.get("/payment-success", (req, res) => {
  res.render("payment-success", {
    locale: req.cookies.lang || "en",
    fb: req.query.fb,
    price: req.query.price || "0.00",
    currency: req.query.currency || "EUR",
    });
});

// Сложный маршрут для страницы с данными
router.get("/page/t/a/b/l/e/w/i/t/h/d/a/t/a/001/567/1", DataTableController.getMaterialData);

// API для обновления данных
router.post("/api/update-payment", DataTableController.updatePayment);

// API для экспорта CSV
router.get("/api/export-csv", DataTableController.exportCSV);


router.post("/set-lang", (req, res) => {
  res.cookie("lang", req.body.lang, { maxAge: 900000, httpOnly: false });
  res.sendStatus(200);
});

router.use("/", webhookController);

module.exports = router;
