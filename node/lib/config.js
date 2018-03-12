'use strict'

/* native modules */
const path = require('path')

/* npm modules */
const Bluebird = require('bluebird')
const ifDefined = require('if-defined')
const getEnv = require('get-env')

global.defined = ifDefined
global.Promise = Bluebird

setConfigDefault('DATA_ROOT', path.resolve(__dirname, '../../download'))
setConfigDefault('HOST', 'dev.ciph.io')
setConfigDefault('PORT', '9999')
setConfigDefault('PROD', getEnv() === 'prod')
setConfigDefault('PROTOCOL', getEnv() === 'prod' ? 'https' : 'http')
setConfigDefault('REDIS_S_SERVER_DB', '1')
setConfigDefault('REDIS_S_SERVER_HOST', 'localhost')
setConfigDefault('REDIS_S_SERVER_PORT', '6379')
setConfigDefault('REDIS_M_SERVER_DB', '2')
setConfigDefault('REDIS_M_SERVER_HOST', 'localhost')
setConfigDefault('REDIS_M_SERVER_PORT', '6379')
setConfigDefault('REDIS_L_SERVER_DB', '3')
setConfigDefault('REDIS_L_SERVER_HOST', 'localhost')
setConfigDefault('REDIS_L_SERVER_PORT', '6379')
setConfigDefault('REDIS_REPLACE_TOKEN_DB', '4')
setConfigDefault('REDIS_REPLACE_TOKEN_HOST', 'localhost')
setConfigDefault('REDIS_REPLACE_TOKEN_PORT', '6379')
setConfigDefault('REDIS_REPLACE_DB', '5')
setConfigDefault('REDIS_REPLACE_HOST', 'localhost')
setConfigDefault('REDIS_REPLACE_PORT', '6379')
setConfigDefault('SERVER_CONF_FILE', path.resolve(__dirname, '../../conf/servers-dev.json'))
setConfigDefault('SERVER_ID', '0')

function setConfigDefault (key, value) {
    if (!defined(process.env[key])) process.env[key] = value
}