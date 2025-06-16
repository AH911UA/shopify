const path = require('path');
const fs = require('fs');

function getDataFromJsonFile(fileName) {
    const pathToJson = path.join(process.cwd(), 'data', fileName);
    const dataRaw = fs.readFileSync(pathToJson, 'utf-8');
    return JSON.parse(dataRaw);
}

module.exports = getDataFromJsonFile;