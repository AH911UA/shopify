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
    async index(req, res, next) {
        try {
            const commentsAll = getDataFromJsonFile('comments.json');
            
            const availableLocales = req.app.get('locales') || i18n.getLocales();
            let determinedLocale = req.getLocale();

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

                if (!langFound) {
                    const ip = (req.ip === '::1' || req.ip === '127.0.0.1') ? '85.34.78.112' : req.ip;
                    try {
                        const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,countryCode`);
                        if (geoResponse.ok) {
                            const geoData = await geoResponse.json();
                            if (geoData.status === 'success' && geoData.countryCode) {
                                const langFromCountry = countryToLang[geoData.countryCode];
                                if (langFromCountry && availableLocales.includes(langFromCountry)) {
                                    determinedLocale = langFromCountry;
                                    langFound = true;
                                }
                            }
                        }
                    } catch (e) {
                        console.error("GeoIP lookup failed:", e.message);
                    }
                }
                
                if (langFound) {
                    res.cookie('lang', determinedLocale, { maxAge: 900000, httpOnly: true });
                    i18n.setLocale(req, determinedLocale);
                }
            }
            
            const comments = commentsAll.map(c => c[determinedLocale] || c['en']);
            const countries = getDataFromJsonFile('countries.json');
            
            res.render('index', {countries, comments, locale: determinedLocale, locales: availableLocales});
        } catch (e) {
            console.log(e)
        }
    }

    sendPaymentInfo(req, res, next) {
        try {

        } catch (e) {
            next(e);
        }
    }
}

module.exports = new MainController();