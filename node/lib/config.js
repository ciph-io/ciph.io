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
setConfigDefault('REDIS_BLOCK_SERVERS_0_DB', '1')
setConfigDefault('REDIS_BLOCK_SERVERS_0_HOST', 'localhost')
setConfigDefault('REDIS_BLOCK_SERVERS_0_PORT', '6379')
setConfigDefault('REDIS_BLOCK_SERVERS_1_DB', '2')
setConfigDefault('REDIS_BLOCK_SERVERS_1_HOST', 'localhost')
setConfigDefault('REDIS_BLOCK_SERVERS_1_PORT', '6379')
setConfigDefault('REDIS_BLOCK_SERVERS_2_DB', '3')
setConfigDefault('REDIS_BLOCK_SERVERS_2_HOST', 'localhost')
setConfigDefault('REDIS_BLOCK_SERVERS_2_PORT', '6379')
setConfigDefault('REDIS_BLOCK_SERVERS_3_DB', '4')
setConfigDefault('REDIS_BLOCK_SERVERS_3_HOST', 'localhost')
setConfigDefault('REDIS_BLOCK_SERVERS_3_PORT', '6379')
setConfigDefault('REDIS_BLOCK_SERVERS_4_DB', '5')
setConfigDefault('REDIS_BLOCK_SERVERS_4_HOST', 'localhost')
setConfigDefault('REDIS_BLOCK_SERVERS_4_PORT', '6379')
setConfigDefault('REDIS_BLOCK_SERVERS_5_DB', '6')
setConfigDefault('REDIS_BLOCK_SERVERS_5_HOST', 'localhost')
setConfigDefault('REDIS_BLOCK_SERVERS_5_PORT', '6379')
setConfigDefault('REDIS_BLOCK_SERVERS_6_DB', '7')
setConfigDefault('REDIS_BLOCK_SERVERS_6_HOST', 'localhost')
setConfigDefault('REDIS_BLOCK_SERVERS_6_PORT', '6379')
setConfigDefault('REDIS_RATINGS_DB', '8')
setConfigDefault('REDIS_RATINGS_HOST', 'localhost')
setConfigDefault('REDIS_RATINGS_PORT', '6379')
setConfigDefault('REDIS_REPLACE_DB', '9')
setConfigDefault('REDIS_REPLACE_HOST', 'localhost')
setConfigDefault('REDIS_REPLACE_PORT', '6379')
setConfigDefault('REDIS_REPLACE_TOKEN_DB', '10')
setConfigDefault('REDIS_REPLACE_TOKEN_HOST', 'localhost')
setConfigDefault('REDIS_REPLACE_TOKEN_PORT', '6379')
setConfigDefault('SERVER_CONF_FILE', path.resolve(__dirname, '../../conf/servers-dev.json'))
setConfigDefault('SERVER_ID', '0')
setConfigDefault('UPLOAD_DIR', path.resolve(__dirname, '../../upload'))

function setConfigDefault (key, value) {
    if (!defined(process.env[key])) process.env[key] = value
}