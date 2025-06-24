require('dotenv').config();
const i18n = require('i18n');
const path = require('path');
const cookieParser = require('cookie-parser');

const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const router = require("./router");
const botRouter = require("./router/bot");

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';

app.disable('x-powered-by');
app.use(helmet());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(multer().none());

app.use('/data', express.static('data'));
app.use('/assets', express.static('assets'));

i18n.configure({
    locales: ['en', 'es', 'ru', 'he', 'zh', 'ar', 'pt', 'fr', 'de', 'hi', 'ja', 'it', 'ko', 'tr', 'nl', 'pl', 'vi', 'th', 'uk', 'ro', 'id'],
    directory: path.join(__dirname, 'locales'),
    defaultLocale: 'en',
    queryParameter: 'lang',
    autoReload: true,
    syncFiles: true,
    cookie: 'lang'
});

app.use(i18n.init);

app.set('view engine', 'ejs');
app.set('views', './views');

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "img-src 'self' data:;"
  );
  next();
});

app.use(router);
app.use('/bot', botRouter);

app.listen(port, () => {
    console.log(`Example app listening on http://${host}:${port}`)
})
