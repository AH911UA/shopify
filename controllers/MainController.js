const path = require("node:path");
const fs = require('fs');
const getDataFromJsonFile = require("../shared/getDataFromJsonFile");
const i18n = require('i18n');

class MainController {
    index(req, res, next) {
        try {
            const commentsAll = getDataFromJsonFile('comments.json');
            const locale = req.getLocale();
            const comments = commentsAll.map(c => c[locale] || c['en']);
            const countries = getDataFromJsonFile('countries.json');
            const locales = req.app.get('locales') || i18n.getLocales();
            res.render('index', {countries, comments, locale, locales});
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