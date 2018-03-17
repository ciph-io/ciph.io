'use strict'

/* npm modules */
const crypto = require('mz/crypto')
const defined = require('if-defined')

/* app modules */
const RedisService = require('./redis-service')
const assert = require('../lib/assert')

/* globals */
const replaceRegExp = /^[0-3]:[0-9a-f]{32}:[0-9a-f]{32}$/
const signatureRegExp = /^[0-9a-f]{64}$/
const tokenRegExp = /^[0-9a-f]{32}$/

/* exports */
module.exports = class ReplaceService {

    /**
     * @function createReplaceToken
     *
     * create and store a replace token/secret pair
     *
     * @returns {Promise<object>}
     */
    static async createReplaceToken () {
        // get random data
        const data = await crypto.randomBytes(64)
        // hash data to create token/secret
        const hash = crypto.createHash('sha256')
        hash.update(data)
        const digest = hash.digest('hex')
        // split digest into token and secret
        const token = digest.substr(0, 32)
        const secret = digest.substr(32, 32)
        // save token
        await RedisService.getClient('replaceToken').set(token, secret)

        return { token, secret }
    }

    /**
     * @function getReplace
     *
     * get replace ids and size for token
     *
     * @param {string} token
     *
     * @returns {Promise<object|undefined>}
     */
    static async getReplace (token) {
        // validate args
        assert(token.match(tokenRegExp), 'invalid token')
        // get replace entry for token
        const replace = await RedisService.getClient('replace').get(token)
        if (!replace) return
        // deleted
        if (replace === 'x') {
            return {deleted: true}
        }
        // decode replace string
        else {
            // replace is size:id:id
            const parts = replace.split(':')

            return {
                b0: parts[1],
                b1: parts[2],
                size: parts[0],
            }
        }
    }

    /**
     * @function replace
     *
     * create new replace entry for token if signature is valid. new replace
     * entry replaces existing.
     *
     * @param {object} args
     * @param {string} args.id
     * @param {string} args.signature
     * @param {string} args.token
     *
     * @returns {Promise<object>}
     */
    static async replace (args) {
        // validate args
        assert(defined(args.replace) && (args.replace === 'x' || args.replace.match(replaceRegExp)), 'invalid replace')
        assert(defined(args.signature) && args.signature.match(signatureRegExp), 'invalid signature')
        assert(defined(args.token) && args.token.match(tokenRegExp), 'invalid token')
        // get secret for token
        const secret = await RedisService.getClient('replaceToken').get(args.token)
        assert(secret, 'invalid token')
        // create hmac to validate signature
        const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'hex'));
        hmac.update(args.replace)
        const signature = hmac.digest('hex')
        console.log(signature)
        // validate signature
        assert(args.signature === signature, 'invalid signature')
        // store replacement id for token
        await RedisService.getClient('replace').set(args.token, args.replace)
    }

}