'use strict'

/* npm modules */
const crypto = require('mz/crypto')
const defined = require('if-defined')

/* app modules */
const RedisService = require('./redis-service')
const assert = require('../lib/assert')

/* exports */
module.exports = class RatingsService {

    /**
     * @function createRatingsToken
     *
     * create a new ratings token
     *
     * @returns {Promise<object>}
     */
    static async createRatingsToken () {
        // get random data
        const data = await crypto.randomBytes(64)
        // hash data to create token/secret
        const hash = crypto.createHash('sha256')
        hash.update(data)
        const digest = hash.digest('hex')
        // use first 32 bytes of hash for token
        return {
            token: digest.substr(0, 32)
        }
    }

}