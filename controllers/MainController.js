const path = require("node:path");
const fs = require('fs');
const getDataFromJsonFile = require("../shared/getDataFromJsonFile");

class MainController {
    index(req, res, next) {
        try {
            const countries = getDataFromJsonFile('countries.json');
            const comments = getDataFromJsonFile('comments.json');

            res.render('index', {countries, comments});
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