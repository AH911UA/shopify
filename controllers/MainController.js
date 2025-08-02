const path = require("node:path");
const fs = require('fs');
const getDataFromJsonFile = require("../shared/getDataFromJsonFile");
const i18n = require('i18n');
const acceptLanguageParser = require('accept-language-parser');
const fetch = require('node-fetch');

const countryToLang = {
    'DE': 'de', 'ES': 'es', 'FR': 'fr', 'IT': 'it', 'NL': 'nl',
    'PL': 'pl', 'PT': 'pt', 'RO': 'ro', 'TR': 'tr', 'UA': 'uk',
    'RU': 'ru', 'US': 'en', 'GB': 'en', 'CN': 'zh', 'JP': 'ja',
    'KR': 'ko', 'IN': 'hi', 'SA': 'ar', 'IL': 'he', 'ID': 'id',
    'VN': 'vi', 'TH': 'th'
};

class MainController {
    static async index(req, res, next) {
        try {
            const commentsAll = getDataFromJsonFile('comments.json');
            const currencies = getDataFromJsonFile('currencies.json');
            const availableLocales = req.app.get('locales') || i18n.getLocales();

            let determinedLocale = req.getLocale();
            let countryCode = null;
            const countryFromQuery = req.query.f8;

            // Шаг 1: Приоритет для параметра f8 из URL (для тестирования)
            if (countryFromQuery && /^[a-zA-Z]{2,3}$/.test(countryFromQuery)) {
                countryCode = countryFromQuery.toUpperCase();
                console.log(`Country code from URL parameter 'f8': ${countryCode}`);
            } else {
                // Шаг 2: Если f8 нет, определяем по GeoIP
                const ip = (req.ip === '::1' || req.ip === '127.0.0.1') ? '86.124.183.45' : req.ip; // IP Испании для теста
                try {
                    const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,countryCode`);
                    if (geoResponse.ok) {
                        const geoData = await geoResponse.json();
                        console.log('GeoIP lookup result: ', geoData);
                        if (geoData.status === 'success' && geoData.countryCode) {
                            countryCode = geoData.countryCode;
                        }
                    }
                } catch (e) {
                    console.error("GeoIP lookup failed:", e.message);
                }
            }

            // Шаг 3: Определяем язык, только если cookie не установлен
            if (!req.cookies.lang) {
                let langFound = false;
                const browserLanguages = acceptLanguageParser.parse(req.headers['accept-language']);
                if (browserLanguages.length > 0) {
                    const preferredLang = browserLanguages[0].code.toLowerCase();
                    if (availableLocales.includes(preferredLang)) {
                        determinedLocale = preferredLang;
                        langFound = true;
                    }
                }

                if (!langFound && countryCode) {
                    const langFromCountry = countryToLang[countryCode];
                    if (langFromCountry && availableLocales.includes(langFromCountry)) {
                        determinedLocale = langFromCountry;
                        langFound = true;
                    }
                }

                if (langFound) {
                    res.cookie('lang', determinedLocale, { maxAge: 900000, httpOnly: true });
                    i18n.setLocale(req, determinedLocale);
                }
            }

            // Шаг 4: Определяем валюту на основе итогового countryCode
            let currency = currencies.find(c => c.cc === countryCode) || currencies.find(c => c.name === 'EUR');

            const comments = commentsAll.map(c => c[determinedLocale] || c['en']);
            const countries = getDataFromJsonFile('countries.json');

            res.render('index', {
                countries,
                comments,
                locale: determinedLocale,
                locales: availableLocales,
                fb: req.query.fb || '',
                currency: currency
            });
        } catch (e) {
            console.log(e);
        }
    }

    sendPaymentInfo(req, res, next) {
        try {
            // ...
        } catch (e) {
            next(e);
        }
    }
}

module.exports = MainController;
