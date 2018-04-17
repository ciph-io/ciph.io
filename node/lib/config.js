'use strict'

/* native modules */
const path = require('path')

/* npm modules */
const getEnv = require('get-env')

/* globals */
global.Promise = require('bluebird')
global.assert = require('./assert')
global.defined = require('if-defined')

setConfigDefault('API_HOST', 'https://dev.ciph.io')
setConfigDefault('CACHE_PATH', '/cache')
setConfigDefault('CACHE_TMP_PATH', '/cache/tmp')
setConfigDefault('CACHE_TIME_FILE_PATH', '/cache/time.file')
setConfigDefault('HOST', 'dev.ciph.io')
setConfigDefault('PORT', '11000')
setConfigDefault('PROD', getEnv() === 'prod')
setConfigDefault('PROTOCOL', getEnv() === 'prod' ? 'https' : 'http')
setConfigDefault('REDIS_CONF_FILE', path.resolve(__dirname, '../../conf/redis-dev.json'))
setConfigDefault('SERVER_CONF_FILE', path.resolve(__dirname, '../../conf/servers-dev.json'))
setConfigDefault('SERVER_ID', '0')
setConfigDefault('UPLOAD_DIR', path.resolve(__dirname, '../../upload'))

function setConfigDefault (key, value) {
    if (!defined(process.env[key])) process.env[key] = value
}