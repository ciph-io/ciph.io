'use strict'

/* npm modules */
const ChangeCase = require('change-case')
const IORedis = require('ioredis')
const fs = require('fs-extra')

/* app modules */
const Type = require('./type')

/* globals */

// load server config file
const redisConf = fs.readJsonSync(process.env.REDIS_CONF_FILE)

// redis client indexed by name
const clientsByName = {}
// redis subscriber clients indexed by name
const subClientsByName = {}
// redis clients for block dbs indexed by block size
const blockServerClients = []
// server id is int/hex
const serverIdRegExp = /^[0-9a-f]+$/

class RedisService {

    /* block servers methods */

    /**
     * @function createNewBlock
     *
     * set block id key if it does not exist with value indicating
     * that it is being uploaded. throw error if key exists.
     *
     * @param {integer} size
     * @param {string} id
     *
     * @returns {Promise<undefined>}
     */
    static async createNewBlock (size, id) {
        const res = await RedisService.getBlockServerClient(size).setnx(id, 'U')
        assert(res === 1, 'blockId exists')
    }

    /**
     * @function createReplace
     *
     * create replace entry for originalId and parentId if it is different
     *
     * @param {string} originalId
     * @param {string} parentId
     * @param {string} link
     *
     * @returns {Promise}
     */
    static async createReplace (originalId, parentId, link) {
        // if parent id is set and different then create entries for both
        if (parentId && parentId !== originalId) {
            // original id points to link and parent id points back to original
            const res = await RedisService.getClient('replace').multi().set(originalId, link).set(parentId, originalId).exec()
            assert(res[0][1] === 'OK' && res[1][1] === 'OK', 'replace error')
        }
        // otherwise create entry only for original id
        else {
            const res = await RedisService.getClient('replace').set(originalId, link)
            assert(res === 'OK', 'replace error')
        }
    }

    /**
     * @function createReplaceToken
     *
     * create replace token for container using private id. throws error if
     * id is already registered.
     *
     * @param {string} privateId
     * @param {string} token
     *
     * @returns {Promise}
     */
    static async createReplaceToken (privateId, token) {
        const res = await RedisService.getClient('replaceToken').setnx(privateId, token)
        assert(res === 1, 'privateId exists')
    }

    /**
     * @function createUser
     *
     * create new user. throw error if user exists.
     *
     * @param {string} userId
     * @param {string} secret
     *
     * @returns {Promise<undefined>}
     */
    static async createUser (userId, secret) {
        const res = await RedisService.getClient('users').setnx(userId, secret)
        assert(res === 1, 'userId exists')
    }

    /**
     * @function decrAnonBlockCount
     *
     * decrement block count for anon id (ip)
     *
     * @param {string} anonId
     *
     * @returns {Promise<string>}
     */
    static async decrAnonBlockCount (anonId) {
        return RedisService.getClient('anonBlockCount').decr(anonId)
    }

    /**
     * @function decrAnonCredit
     *
     * decrement credit for anon id (ip)
     *
     * @param {string} anonId
     * @param {integer|string} amount
     *
     * @returns {Promise<string>}
     */
    static async decrAnonCredit (anonId, amount) {
        return RedisService.getClient('anonCredit').decrby(anonId, amount)
    }

    /**
     * @function decrUserCredit
     *
     * decrement credit for user id
     *
     * @param {string} userId
     * @param {integer|string} amount
     *
     * @returns {Promise<string>}
     */
    static async decrUserCredit (userId, amount) {
        return RedisService.getClient('userCredit').decrby(userId, amount)
    }

    /**
     * @function getAnonBlockCount
     *
     * get sum of blocks/unblocks for anon
     *
     * @param {string} anonId
     *
     * @returns {Promise<string>}
     */
    static async getAnonBlockCount (anonId) {
        const blockCount = parseInt( await RedisService.getClient('anonBlockCount').get(anonId) )

        return blockCount > 0 ? blockCount : 0
    }

    /**
     * @function getAnonBlocks
     *
     * get anon blocks
     *
     * @param {string} anonId
     * @param {object|string} blocks
     *
     * @returns {Promise<object>}
     */
    static async getAnonBlocks (anonId) {
        let blocks = await RedisService.getClient('anonBlocks').get(anonId)
        if (blocks === null) {
            return {}
        }
        else {
            try {
                return JSON.parse(blocks)
            }
            catch (err) {
                console.error(err)
                return {}
            }
        }
    }

    /**
     * @function getAnonCredit
     *
     * get anon credit
     *
     * @param {string} anonId
     *
     * @returns {Promise<integer>}
     */
    static async getAnonCredit (anonId) {
        return RedisService.getClient('anonCredit').get(anonId)
    }

    /**
     * @function getBlockServers
     *
     * get list of server ids for block.
     *
     * @param {integer} size
     * @param {string} id
     *
     * @returns {Promise<object>}
     */
    static async getBlockServers (size, id) {
        const serversStr = await RedisService.getBlockServerClient(size).get(id)
        assert(serversStr, 'getBlock failed')

        const servers = serversStr.split(',')

        return { id, servers, size }
    }

    /**
     * @function getBlockServersMulti
     *
     * get list of server ids for blocks.
     *
     * @param {integer} size
     * @param {array} ids
     *
     * @returns {Promise<object>}
     */
    static async getBlockServersMulti (size, ids) {
        // create new pipeline to execute batch of commands
        const pipeline = RedisService.getBlockServerClient(size).pipeline()
        // get each id
        for (const id of ids) {
            pipeline.get(id)
        }
        // execute all gets
        const results = await pipeline.exec()
        // decode results
        for (let i=0; i<results.length; i++) {
            // result is array with [err, val]
            if (!results[i][0] && results[i][1]) {
                // servers are comma separated ids
                const servers = results[i][1].split(',')
                // only keep valid server ids
                if (servers[0].match(serverIdRegExp)) {
                    results[i] = {
                        id: ids[i],
                        servers: servers,
                        size: size,
                    }
                }
                else {
                    results[i] = null
                }
            }
            // result has error or not found
            else {
                results[i] = null
            }
        }

        return results
    }

    /**
     * @function getRandomBlockIds
     *
     * get ids for random blocks of given size.
     *
     * @param {integer} size
     *
     * @returns {Promise<object>}
     */
    static async getRandomBlockIds (size) {
        // create new pipeline to get multiple random blocks
        const pipeline = RedisService.getBlockServerClient(size).pipeline()
        // get 5 random block ids
        pipeline.randomkey()
        pipeline.randomkey()
        pipeline.randomkey()
        pipeline.randomkey()
        pipeline.randomkey()
        // execute queued commands
        const results = await pipeline.exec()
        // extract ids from results
        return results.map(result => result[1]).filter(result => result !== null)
    }

    /**
     * @function getReplace
     *
     * get replacement link for container using private id
     *
     * @returns {Promise<null|string>}
     */
    static async getReplace (privateId) {
        let res = await RedisService.getClient('replace').get(privateId)
        // if result is null or a valid link then return
        if (res === null || Type.isValidSecureLink(res) || Type.isValidDelete(res)) {
            return res
        }
        // if result is another id then fetch again
        if (Type.isValidHex32(res)) {
            res = await RedisService.getClient('replace').get(res)
            // return if link found
            if (Type.isValidSecureLink(res) || Type.isValidDelete(res)) {
                return res
            }
        }
        // return null if no valid links found
        return null
    }

    /**
     * @function getReplaceToken
     *
     * get replace token for container using private id
     *
     * @returns {Promise<null|string>}
     */
    static async getReplaceToken (privateId, token) {
        return RedisService.getClient('replaceToken').get(privateId)
    }

    /**
     * @function getUserCredit
     *
     * get user credit
     *
     * @param {string} userId
     *
     * @returns {Promise<integer>}
     */
    static async getUserCredit (userId) {
        return RedisService.getClient('userCredit').get(userId)
    }

    /**
     * @function getUserSecret
     *
     * get user secret
     *
     * @param {string} userId
     *
     * @returns {Promise<null|string>}
     */
    static async getUserSecret (userId) {
        return RedisService.getClient('users').get(userId)
    }

    /**
     * @function incrAnonBlockCount
     *
     * increment block count for anon id (ip)
     *
     * @param {string} anonId
     *
     * @returns {Promise<string>}
     */
    static async incrAnonBlockCount (anonId) {
        return RedisService.getClient('anonBlockCount').incr(anonId)
    }

    /**
     * @function sendChatMessage
     *
     * publish data to chat channel
     */
    static async sendChatMessage (data) {
        if (typeof data === 'object') {
            data = JSON.stringify(data)
        }
        return RedisService.getClient('chat').publish('chat', data)
    }

    /**
     * @function setAnonCredit
     *
     * set anon credit
     *
     * @param {string} anonId
     * @param {number|string} credit
     *
     * @returns {Promise<integer>}
     */
    static async setAnonCredit (anonId, credit) {
        return RedisService.getClient('anonCredit').set(anonId, credit)
    }

    /**
     * @function setAnonBlocks
     *
     * set anon blocks
     *
     * @param {string} anonId
     * @param {object|string} blocks
     *
     * @returns {Promise<undefined>}
     */
    static async setAnonBlocks (anonId, blocks) {
        if (typeof blocks === 'object') {
            blocks = JSON.stringify(blocks)
        }
        return RedisService.getClient('anonBlocks').set(anonId, blocks)
    }

    /**
     * @function setServers
     *
     * set list of server ids for block id.
     *
     * @param {integer} size
     * @param {string} id
     * @param {array}  servers
     *
     * @returns {Promise<undefined>}
     */
    static async setServers (size, id, servers) {
        return RedisService.getBlockServerClient(size).set(id, servers.join(','))
    }

    /* redis client management methods */

    static async disconnectAll () {
        return Promise.all(Object.keys(clientsByName).map(clientName => {
            return RedisService.getClient(clientName).disconnect()
        }))
    }

    static async flushAll () {
        return Promise.all(Object.keys(clientsByName).map(clientName => {
            return RedisService.getClient(clientName).flushdb()
        }))
    }

    static getClient (name) {
        assert(defined(clientsByName[name]), 'invalid client name')
        return clientsByName[name]
    }

    static getSubClient (name) {
        assert(defined(subClientsByName[name]), 'invalid sub client name')
        return subClientsByName[name]
    }

    static getBlockServerClient (size) {
        assert(defined(blockServerClients[size]), 'invalid client block size')
        return blockServerClients[size]
    }

    static newClient (name, conf) {
        // create client
        clientsByName[name] = new IORedis(conf)
        // log errors
        clientsByName[name].on('error', console.error)
        // also create subscriber connections for chat clients
        if (name.match(/^chat/)) {
            // create sub client
            subClientsByName[name] = new IORedis(conf)
            // log errors
            subClientsByName[name].on('error', console.error)
        }
    }

    static async quit () {
        return Promise.all(Object.keys(clientsByName).map(clientName => {
            return RedisService.getClient(clientName).quit()
        }))
    }

}


/* initalize redis clients */

if (!defined(process.env.NO_REDIS)) {
    // connect all clients
    for (const name in redisConf) {
        RedisService.newClient(name, redisConf[name])
    }
    // make sure all block clients defined
    for (let size=0; size <= 6; size++) {
        assert(defined(clientsByName[`blockServers${size}`]), `redis block server ${size} not defined`)
        blockServerClients[size] = clientsByName[`blockServers${size}`]
    }
}

/* exports */

module.exports = RedisService