'use strict'

/* npm modules */
const ChangeCase = require('change-case')
const IORedis = require('ioredis')

/* app modules */
const assert = require('./assert')

/* globals */

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
    static async createNewBlock (size, id, time) {
        const res = await RedisService.getBlockServerClient(size).setnx(id, `U,${time}`)
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

    static newClient (name) {
        // use camel case internally
        const caName = ChangeCase.camelCase(name)
        // use constant case for env vars
        const coName = ChangeCase.constantCase(name)
        // require args
        assert(defined(process.env[`REDIS_${coName}_DB`]), `env.REDIS_${coName}_DB required`)
        assert(defined(process.env[`REDIS_${coName}_HOST`]), `env.REDIS_${coName}_HOST required`)
        assert(defined(process.env[`REDIS_${coName}_HOST`]), `env.REDIS_${coName}_PORT required`)
        // build client args
        const args = {
            db: process.env[`REDIS_${coName}_DB`],
            host: process.env[`REDIS_${coName}_HOST`],
            port: process.env[`REDIS_${coName}_PORT`],
        }
        if (defined(process.env[`REDIS_${coName}_PASS`])) {
            args.password = process.env[`REDIS_${coName}_PASS`]
        }
        // create client
        clientsByName[caName] = new IORedis(args)
        // log errors
        clientsByName[caName].on('error', console.error)

        return clientsByName[caName]
    }

    static async quit () {
        return Promise.all(Object.keys(clientsByName).map(clientName => {
            return RedisService.getClient(clientName).quit()
        }))
    }

}


/* initalize redis clients */

// one client for storing map of blocks to servers for each block size
for (let size=0; size <= 3; size++) {
    const name = `BLOCK_SERVERS_${size}`
    blockServerClients[size] = RedisService.newClient(name)
}

// client for storing ratings
RedisService.newClient('ratings')
// client for storing block replace ids
RedisService.newClient('replace')
// client for storing replace tokens
RedisService.newClient('replaceToken')

/* exports */

module.exports = RedisService