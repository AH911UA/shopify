require('dotenv').config()

const express = require('express')
const helmet = require('helmet')
const router = require("./router")

const app = express()
const port = process.env.PORT || 3000
const host = process.env.HOST || 'localhost'

app.disable('x-powered-by')
app.use(helmet())
app.use('/data', express.static('data'));
app.use('/assets', express.static('assets'))
// app.use(express.json())

app.set('view engine', 'ejs')
app.set('views', './views')

app.use(router)

app.listen(port, () => {
    console.log(`Example app listening on http://${host}:${port}`)
})