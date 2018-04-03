'use strict'

/* npm modules */
const ChangeCase = require('change-case')
const IORedis = require('ioredis')
const fs = require('fs-extra')

/* app modules */
const assert = require('./assert')

/* globals */

// load server config file
const redisConf = fs.readJsonSync(process.env.REDIS_CONF_FILE)

// redis client indexed by name
const clientsByName = {}
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
     * @function getRandomBlockServers
     *
     * get id and servers for random block of given size.
     *
     * @param {integer} size
     *
     * @returns {Promise<object>}
     */
    static async getRandomBlockServers (size) {
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
        const ids = results.map(result => result[1])
        // get blocks for ids
        return RedisService.getBlockServersMulti(size, ids)
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

    static getBlockServerClient (size) {
        assert(defined(blockServerClients[size]), 'invalid client block size')
        return blockServerClients[size]
    }

    static newClient (name, conf) {
        // create client
        clientsByName[name] = new IORedis(conf)
        // log errors
        clientsByName[name].on('error', console.error)

        return clientsByName[name]
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

    // client for storing ratings
    // RedisService.newClient('ratings')
    // client for storing block replace ids
    // RedisService.newClient('replace')
    // client for storing replace tokens
    // RedisService.newClient('replaceToken')
}


/* exports */

module.exports = RedisService