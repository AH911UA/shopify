const router = require("express").Router();
const MainController = require("../controllers/MainController");
const paymentController = require("../controllers/paymentController");
const webhookController = require("../controllers/webhookController");
const SubscriptionController = require("../controllers/SubscriptionController");
const { syncAllPaymentsToSheets, googleSheetsManager } = require("../lib/googleSheets");

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

// Маршруты для синхронизации с Google Sheets
router.get("/sync", (req, res) => {
  res.render("sync");
});

router.post("/api/sync/sheets", async (req, res) => {
  try {
    const result = await syncAllPaymentsToSheets();
    res.json(result);
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
    res.json({ success: false, error: error.message });
  }
});

router.get("/api/sync/status", async (req, res) => {
  try {
    const googleSheets = await googleSheetsManager.initialize();
    const database = true; // Предполагаем, что БД работает
    
    res.json({
      googleSheets: googleSheets,
      database: database
    });
  } catch (error) {
    console.error('❌ Ошибка проверки статуса:', error);
    res.json({
      googleSheets: false,
      database: false,
      error: error.message
    });
  }
});

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

router.post("/set-lang", (req, res) => {
  res.cookie("lang", req.body.lang, { maxAge: 900000, httpOnly: false });
  res.sendStatus(200);
});

router.use("/", webhookController);

module.exports = router;
