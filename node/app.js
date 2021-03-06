'use strict'

/* npm modules */
const express = require('express')
const multer = require('multer')

/* initialize process.env */
require('./lib/config')

/* app modules */
const RedisService = require('./lib/redis-service')
const ServerService = require('./lib/server-service')
const errorWrapper = require('./lib/error-wrapper')

/* route handlers */
const getBlock = require('./app/get-block')
const getBlocks = require('./app/get-blocks')
const getGet = require('./app/get-get')
const getGetProxyNode = require('./app/get-get-proxy-node')
const getRandom = require('./app/get-random')
const getReferral = require('./app/get-referral')
const getReplace = require('./app/get-replace')
const getUser = require('./app/get-user')
const getUserEpycly = require('./app/get-user-epycly')
const postPublishFinish = require('./app/post-publish-finish')
const postPublishStart = require('./app/post-publish-start')
const postReplace = require('./app/post-replace')
const postReplaceToken = require('./app/post-replace-token')
const postUpload = require('./app/post-upload')
const postUser = require('./app/post-user')

/* express configuration */

const app = express()

app.disable('x-powered-by')
app.enable('strict routing')
app.enable('case sensitive routing')
app.use(express.json())

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

// multer middleware for block upload
const upload = multer({
    dest: process.env.UPLOAD_DIR,
    limits: {
        fieldSize: 256,
        fields: 16,
        fileSize: 16*1024*1024,
        files: 1,
        parts: 16,
        headerPairs: 16,
    },
})

/* express routes */

app.get('/block', errorWrapper(getBlock))
app.get('/blocks', errorWrapper(getBlocks))
app.get('/get/:size/:id', errorWrapper(getGet))
app.get('/get-proxy', errorWrapper(getGetProxyNode))
app.get('/get-proxy-node', errorWrapper(getGetProxyNode))
app.get('/r', errorWrapper(getReferral))
app.get('/random', errorWrapper(getRandom))
app.get('/replace', errorWrapper(getReplace))
app.get('/user', errorWrapper(getUser))
app.get('/user/epycly', errorWrapper(getUserEpycly))
app.post('/publish/finish', errorWrapper(postPublishFinish))
app.post('/publish/start', errorWrapper(postPublishStart))
app.post('/replace', errorWrapper(postReplace))
app.post('/replace/token', errorWrapper(postReplaceToken))
app.post('/upload', upload.single('block'), errorWrapper(postUpload))
app.post('/user', errorWrapper(postUser))

/* 404 handler */

app.use((req,res) => {
    res.status(404).json({error: 'not found'})
});

/* error handler */

app.use((error, req, res, next) => {
    // error must be object with stack
    if (typeof error !== 'object' || typeof error.stack !== 'string') {
        error = new Error(error)
    }
    // get http code from error code
    let code = error.code
    // if code is not between 300 and 500 then set to 500
    if (!(code >= 300 && code <= 500)) {
        code = error.code = 500
    }
    // set http status code
    res.status(code)
    // set error
    res.json({
        code: code,
        error: error.message,
        stack: process.env.PROD === 'true' ? undefined : error.stack.split('\n'),
    })
})

/* start server */

startServer().catch(err => {
    console.error(err)
    process.exit()
})

async function startServer () {
    // start listening for requests
    app.listen(process.env.PORT, () => {
        console.log(`server listening on ${process.env.PORT}`)
    })
}