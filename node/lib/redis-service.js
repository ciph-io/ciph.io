'use strict'

/* npm modules */
const IORedis = require('ioredis')

/* app modules */
const assert = require('./assert')

/* client for mapping (s)mall blocks to servers */
const sServerClientArgs = {
    db: process.env.REDIS_S_SERVER_DB,
    host: process.env.REDIS_S_SERVER_HOST,
    port: process.env.REDIS_S_SERVER_PORT,
}

if (defined(process.env.REDIS_S_SERVER_PASS)) {
    serverClientArgs.password = process.env.REDIS_S_SERVER_PASS
}

const sServerClient = new IORedis(sServerClientArgs)
sServerClient.on('error', console.error);

/* client for mapping (m)edium blocks to servers */
const mServerClientArgs = {
    db: process.env.REDIS_M_SERVER_DB,
    host: process.env.REDIS_M_SERVER_HOST,
    port: process.env.REDIS_M_SERVER_PORT,
}

if (defined(process.env.REDIS_M_SERVER_PASS)) {
    serverClientArgs.password = process.env.REDIS_M_SERVER_PASS
}

const mServerClient = new IORedis(mServerClientArgs)
mServerClient.on('error', console.error);

/* client for mapping (l)arge blocks to servers */
const lServerClientArgs = {
    db: process.env.REDIS_L_SERVER_DB,
    host: process.env.REDIS_L_SERVER_HOST,
    port: process.env.REDIS_L_SERVER_PORT,
}

if (defined(process.env.REDIS_L_SERVER_PASS)) {
    serverClientArgs.password = process.env.REDIS_L_SERVER_PASS
}

const lServerClient = new IORedis(lServerClientArgs)
lServerClient.on('error', console.error);

module.exports = class RedisService {

    static async flushServers () {
        return Promise.all([
            lServerClient.flushdb(),
            mServerClient.flushdb(),
            sServerClient.flushdb(),
        ])
    }


    /**
     * @function getBlock
     *
     * get list of server ids for block.
     *
     * @param {string} size (s|m|l)
     * @param {string} id
     *
     * @returns {Promise<object>}
     */
    static async getBlock (size, id) {
        const serversStr = await RedisService.serverClient(size).get(id)
        assert(serversStr, 'getBlock failed')

        const servers = serversStr.split(',')

        return { id, servers, size }
    }

    /**
     * @function getRandomBlock
     *
     * get id and servers for random block of given size.
     *
     * @param {string} size (s|m|l)
     *
     * @returns {Promise<object>}
     */
    static async getRandomBlock (size) {
        const id = await RedisService.serverClient(size).randomkey()
        assert(id, 'getRandomBlock failed')

        return RedisService.getBlock(size, id)
    }

    /**
     * @function serverClient
     *
     * get redis client that corresponds to block size.
     *
     * @param {string} size (s|m|l)
     *
     * @returns {Redis}
     */
    static serverClient (size) {
        switch (size) {
            case 'l':
                return lServerClient
            case 'm':
                return mServerClient
            case 's':
                return sServerClient
            default:
                throw new Error('invalid size')
        }
    }

    static lServerClient () {
        return lServerClient
    }

    static mServerClient () {
        return mServerClient
    }

    static sServerClient () {
        return sServerClient
    }

    /**
     * @function setServers
     *
     * set list of server ids for block id.
     *
     * @param {string} size (s|m|l)
     * @param {string} id
     * @param {array}  servers
     *
     * @returns {Promise<undefined>}
     */
    static async setServers (size, id, servers) {
        return RedisService.serverClient(size).set(id, servers.join(','))
    }

    static async quit () {
        return Promise.all([
            lServerClient.quit(),
            mServerClient.quit(),
            sServerClient.quit(),
        ])
    }

}