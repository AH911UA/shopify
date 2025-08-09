require('dotenv').config();
const i18n = require('i18n');
const path = require('path');
const cookieParser = require('cookie-parser');

const express = require('express');
// Отключаем helmet полностью
// const helmet = require('helmet');
const multer = require('multer');
const router = require("./router");
// Отключаем cors middleware
// const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';

app.disable('x-powered-by');

// Глобальный middleware для отключения CORS
app.use((req, res, next) => {
  // Устанавливаем все необходимые заголовки для отключения CORS
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With, Origin');
  res.header('Access-Control-Expose-Headers', '*');
  
  // Обрабатываем preflight запросы
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(multer().none());

app.use('/data', express.static('data'));
app.use('/assets', express.static('assets'));

i18n.configure({
    locales: ['en', 'es', 'ru', 'he', 'zh', 'ar', 'pt', 'fr', 'de', 'hi', 'ja', 'it', 'el', 'ko', 'tr', 'nl', 'pl', 'vi', 'th', 'uk', 'ro', 'id'],
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

// Отключаем CSP ограничения
app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Security-Policy');
  res.removeHeader('X-WebKit-CSP');
  next();
});

app.use(router);

app.listen(port, () => {
    console.log(`Example app listening on http://${host}:${port} - ALL CORS RESTRICTIONS DISABLED`)
})
