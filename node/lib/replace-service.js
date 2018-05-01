'use strict'

/* npm modules */
const crypto = require('mz/crypto')

/* app modules */
const RedisService = require('./redis-service')
const Type = require('./type')

/* exports */
module.exports = class ReplaceService {

    /**
     * @function createReplaceToken
     *
     * create replace token entry for private id. generate random token if
     * no provided.
     *
     * @param {string} privateId
     * @param {string} token
     *
     * @returns {Promise<object>}
     */
    static async createReplaceToken (privateId, token) {
        assert(Type.isValidHex32(privateId), 'invalid privateId')
        // validate token it passed in
        if (token) {
            assert(Type.isValidHex32(token), 'invalid token')
        }
        // otherwise create
        else {
            token = (await crypto.randomBytes(16)).toString('hex')
        }
        // store token - throws on error
        await RedisService.createReplaceToken(privateId, token)

        return { privateId, token }
    }

    /**
     * @function getReplace
     *
     * get replace link for container if it exists
     *
     * @param {string} privateId
     *
     * @returns {Promise<object|undefined>}
     */
    static async getReplace (privateId) {
        // validate args
        assert(Type.isValidHex32(privateId), 'invalid privateId')
        // get replace entry for container
        return RedisService.getReplace(privateId)
    }

    /**
     * @function replace
     *
     * create new replace entry for token if signature is valid. new replace
     * entry replaces existing.
     *
     * @param {object} args
     * @param {string} args.link
     * @param {string} args.originalId
     * @param {string} args.parentId
     * @param {string} args.token
     *
     * @returns {Promise<object>}
     */
    static async replace (args) {
        // validate args
        assert(Type.isValidSecureLink(args.link), 'invalid link')
        assert(Type.isValidHex32(args.originalId), 'invalid originalId')
        assert(Type.isValidHex32(args.parentId), 'invalid parentId')
        assert(Type.isValidHex32(args.token), 'invalid token')
        // token must validate against the container being replaced
        const token = await RedisService.getReplaceToken(args.originalId)
        assert(args.token === token, 'invalid token')
        // create replacement entries
        await RedisService.createReplace(args.originalId, args.parentId, args.link)
    }

}