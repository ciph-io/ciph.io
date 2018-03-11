'use strict'

/* native modules */
const path = require('path')

/* npm modules */
const defined = require('if-defined')
const express = require('express')

/* application modules */
const errorWrapper = require('./lib/error-wrapper')
const getBlock = require('./app/get-block')
const getRandom = require('./app/get-random')
const postPublishFinish = require('./app/publish/post-finish')
const postPublishStart = require('./app/publish/post-start')
const postUpload = require('./app/post-upload')

/* env config */
if (!defined(process.env.HOST)) process.env.HOST = 'dev.ciph.io'
if (!defined(process.env.PORT)) process.env.PORT = '9999'
if (!defined(process.env.ROOT)) process.env.ROOT = path.resolve(__dirname, '../data')

/* express configuration */

const app = express()

app.disable('x-powered-by')
app.enable('strict routing')
app.enable('case sensitive routing')

/* express routes */

app.get('/block', errorWrapper(getBlock))
app.get('/random', errorWrapper(getRandom))
app.post('/publish/finish', errorWrapper(postPublishFinish))
app.post('/publish/start', errorWrapper(postPublishStart))
app.post('/upload', errorWrapper(postUpload))

/* start server */

app.on('error', (err) => {
    // only deal with listen errors
    if (err.syscall !== 'listen') {
        throw err
    }
    // error msg detail
    var msg
    // get specific errors
    if (err.code === 'EACCES') {
        msg = 'permission denied'
    }
    else if (err.code === 'EADDRINUSE') {
        msg = 'address in use'
    }
    else {
        msg = err.code
    }
    throw new Error(`listen on port ${process.env.PORT} failed: ${msg}`)
})

app.listen(process.env.PORT, () => {
    console.log(`server listening on ${process.env.PORT}`)
})