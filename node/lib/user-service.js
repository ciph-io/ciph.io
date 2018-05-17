'use strict'

/* npm modules */
const bytes = require('bytes')
const crypto = require('mz/crypto')
const request = require('request-promise')

/* app modules */
const RedisService = require('./redis-service')
const ServerService = require('./server-service')

/* globals */
const GB = 1024**3
const hex32RegExp = /^[0-9a-f]{32}$/

/* exports */
module.exports = class UserService {

    /**
     * @function createUser
     *
     * create user. userId and secret are optional and random values will be
     * generated if they are not provided.
     *
     * @param {string} ip
     * @param {string} userId
     * @param {string} secret
     *
     * @returns {Promise<object>}
     */
    static async createUser (ip, userId, secret) {
        const anonId = UserService.getAnonId(ip)
        // get valid user id
        if (defined(userId)) {
            assert(UserService.isValidUserId(userId), 'invalid userId')
        }
        else {
            userId = await crypto.randomBytes(16)
            userId = userId.toString('hex')
        }
        // get valid secret
        if (defined(secret)) {
            assert(UserService.isValidSecret(secret), 'invalid secret')
        }
        else {
            secret = await crypto.randomBytes(16)
            secret = secret.toString('hex')
        }
        // create user - throws on error
        await RedisService.createUser(userId, secret)
        // give register credit if anon qualifies - ignore errors
        await RedisService.giveAnonRegisterCredit(anonId, userId).catch(console.error)
        // return created user details
        return { userId, secret }
    }

    /**
     * @function getAnonId
     *
     * anon id is derived from ip
     *
     * @param {string} ip
     *
     * @returns {string}
     */
    static getAnonId (ip) {
        return ServerService.getServerSignature(ip, 0).substr(0, 8)
    }

    /**
     * @function getUser
     *
     * get user. validate secret. return info.
     *
     * @param {string} ip
     * @param {string} userId
     * @param {string} secret
     *
     * @returns {Promise<object>}
     */
    static async getUser (ip, userId, secret) {
        const anonId = UserService.getAnonId(ip)
        // user data to return
        const user = { anonId }
        // if userId and secret are passed in then validate
        if (UserService.isValidUserId(userId) && UserService.isValidSecret(secret)) {
            // get user secret from redis
            const storedSecret = await RedisService.getUserSecret(userId)
            // if secret matches then user is logged in
            if (secret === storedSecret) {
                user.displayUserId = userId.substr(0, 8)
                user.userId = userId
                user.secret = secret
            }
        }
        // get credit for both anon (ip) and user if logged in
        const userCredit = await UserService.getUserCredit(anonId, userId)
        user.credit = userCredit.anonCredit + userCredit.userCredit
        user.displayCredit = bytes.format(user.credit)
        // if user has positive balance then create signed token for download
        if (user.credit > 0) {
            user.token = {}
            // set time
            user.token.time = Math.floor(Date.now() / 1000)
            // set token to expire in 90 seconds - clients should refresh every 60
            user.token.expires = Math.floor(Date.now() / 1000) + 90
            // if user has credit create token for user id
            if (userCredit.userCredit > 0) {
                user.token.type = 'user'
                user.token.value = ServerService.getDownloadToken(user.userId+user.token.expires)
            }
            // otherwise use anon credit
            else {
                user.token.type = 'anon'
                user.token.value = ServerService.getDownloadToken(user.anonId+user.token.expires)
            }
        }

        return user
    }

    /**
     * @function getUserCredit
     *
     * get combined credit balance for user and anon
     *
     * @param {string} anonId
     * @param {string} userId
     *
     * @returns {Promise<object>}
     */
    static async getUserCredit (anonId, userId) {
        const credit = {
            anonCredit: 0,
            userCredit: 0,
        }
        // if user id is provided get user credit
        const userCreditPromise = userId
            ? RedisService.getUserCredit(userId)
            : null
        // get anon credit
        let anonCredit = await RedisService.getAnonCredit(anonId)
        // if anon credit is not set then default to 10GB
        if (anonCredit === null) {
            anonCredit = 10*GB
            // set credit - ignore response
            RedisService.setAnonCredit(anonCredit).catch(console.error)
        }
        // add anon credit to credit balance
        credit.anonCredit = parseInt(anonCredit)
        // if user credit fetched add it
        if (userCreditPromise) {
            const userCredit = parseInt(await userCreditPromise)
            if (userCredit) {
                credit.userCredit = userCredit
            }
        }
        // return combined credit balance
        return credit
    }

    /**
     * @function getUserEpycly
     *
     * get epycly sessionId for cdn payment
     *
     * @param {string} userId
     * @param {string} secret
     *
     * @returns {Promise<object>}
     */
    static async getUserEpycly (userId, secret) {
        assert(UserService.isValidUserId(userId), 'invalid userId')
        assert(UserService.isValidSecret(secret), 'invalid secret')
        // validate secret
        const storedSecret = await RedisService.getUserSecret(userId)
        assert(storedSecret === secret, 'invalid secret')
        // get session id from epycly
        const res = await request({
            body: {
                secret: process.env.EPYCLY_SECRET,
                source: 'ciph',
                userId: userId,
            },
            json: true,
            method: 'POST',
            uri: `${process.env.EPYCLY_HOST}/cloud/connect`,
        })
        assert(res && res.sessionId, 'invalid response')

        return { sessionId: res.sessionId }
    }

    static isValidUserId (userId) {
        return typeof userId === 'string' && userId.match(hex32RegExp)
    }

    static isValidSecret (secret) {
        return typeof secret === 'string' && secret.match(hex32RegExp)
    }

}