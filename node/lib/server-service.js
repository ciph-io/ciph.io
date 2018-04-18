'use strict'

/* native modules */
const fs = require('fs')

/* npm modules */
const crypto = require('mz/crypto')
const defined = require('if-defined')
const randomItem = require('random-item')

/* app modules */
const RedisService = require('./redis-service')

/* globals */

// proxy servers grouped by tier - tier 0 is main server
const proxyServersByTier = []

const serverTypes = {
    data: {},
    proxy: {},
    web: {},
}

const shardDirs = {
    '2': 256,
    '3': 4096,
}

// load server config file
const serverConf = JSON.parse( fs.readFileSync(process.env.SERVER_CONF_FILE, 'utf8') )
// map of servers by type
const serversByType = {}
// create list of servers for each type
for (const serverType in serverTypes) {
    serversByType[serverType] = []
}
// convert secrets to buffers
for (const server of serverConf) {
    // require valid type
    assert(serverTypes[server.type], 'invalid server type')
    // if server is sharded shard conf must be defined
    if (defined(server.shard)) {
        assert(defined(server.shards) && defined(server.shardPrefix), 'shard server must have shards and shardPrefix defined')
    }
    if (server.type === 'data') {
        // data servers must have shard prefix to split files into folders
        assert(shardDirs[server.shardPrefix], 'inavlid shardPrefix')
        // total number of shard dirs
        server.shardDirs = shardDirs[server.shardPrefix]
        // data servers must have data dir(s)
        assert(Array.isArray(server.dataDirs), 'invalid dataDirs')
        server.numDataDirs = server.dataDirs.length
    }
    // if server is proxy server then group by tier
    if (server.type === 'proxy') {
        assert(parseInt(server.tier) === server.tier, 'tier required')
        // create entry for tier if it doesn't exist
        if (!defined(proxyServersByTier[server.tier])) {
            proxyServersByTier[server.tier] = []
        }
        proxyServersByTier[server.tier].push(server)
    }
    // group servers by type
    serversByType[server.type].push(server)
    // convert secret to buffer for crypto operations
    server.secretBuffer = Buffer.from(server.secret, 'hex')
    // freeze server conf
    Object.freeze(server)
}

// freeze server conf
Object.freeze(serverConf)
Object.freeze(serversByType)

/* exports */
module.exports = class ServerService {

    /**
     * @function getDataServer
     *
     * get data server, sharded by block id, and randomized
     *
     * @param {string} blockId
     *
     * @returns {Promise<object>}
     */
    static getDataServer (blockId) {
        // get data servers for block id
        const servers = ServerService.getServers('data', blockId)
        // get random server
        return randomItem(servers)
    }

    /**
     * @function getProxyServer
     *
     * get proxy server of appropriate tier or use main server if request
     * is from a tier 1 proxy server
     *
     * @param {int|string} tier
     *
     * @returns {Promise<object>}
     */
    static getProxyServer (tier) {
        const server = ServerService.getServer()
        // get integer if tier is passed
        if (defined(tier)) {
            tier = parseInt(tier)
            assert(!Number.isNaN(tier), 'invalid tier')
        }
        // if tier is not specified then select based on current server
        else {
            // if this is proxy server then get tier above current
            if (server.type === 'proxy') {
                tier = server.tier - 1
            }
            // otherwise get lowest tier available
            else {
                tier = proxyServersByTier.length - 1
            }
        }
        // only get from proxy servers if on a lower tier proxy server
        if (tier === 0 || server.type !== 'proxy') {
            return ServerService.getWebServer()
        }
        // get random proxy server from correct tier
        else {
            assert(Array.isArray(proxyServersByTier[tier]) && proxyServersByTier[tier].length, 'no servers for tier')

            return randomItem(proxyServersByTier[tier])
        }
    }

    /**
     * @function getServer
     *
     * get current server based on env SERVER_ID
     *
     *  @returns {object}
     */
    static getServer () {
        return ServerService.getServerById(process.env.SERVER_ID)
    }

    /**
     * @function getServers
     *
     * get list of servers by type with optional blockId to get only the
     * servers that server the slice containing the blockId
     *
     * @param {string} serverType
     * @param {string} blockId
     *
     * @returns {array}
     */
    static getServers (serverType, blockId) {
        // require valid server type
        assert(serverTypes[serverType], 'invalid server type')
        // list of all servers
        const servers = serversByType[serverType]
        // return all servers if block id not provide
        if (!defined(blockId)) {
            return servers
        }
        // list of servers that server block id
        const blockServers = []
        // check each server to see if it will server block
        for (const server of servers) {
            // always use server if it is not sharded
            if (!defined(server.shard)) {
                blockServers.push(server)
            }
            // get shard prefix from block id
            const prefix = blockId.substr(0, server.shardPrefix)
            // convert prefix to integer
            const int = parseInt(prefix, 16)
            // get shard by taking the modulo of the prefix and number of shards
            const shard = int % server.shards
            // use this server if shard matches
            if (server.shard === shard) {
                blockServers.push(server)
            }
        }

        return blockServers
    }

    /**
     * @function getServerById
     *
     * get server root url from hex id
     *
     * @param {string} id
     *
     * @returns {object}
     */
    static getServerById (id) {
        // convert id to int from hex
        const intId = parseInt(id, 16)
        assert(serverConf[id], 'invalid server id')

        return serverConf[id]
    }

    /**
     * @function getServerSignature
     *
     * sign input with server secret
     *
     * @param {buffer|string} data
     * @param {integer|string} serverId
     *
     * @return {string}
     */
    static getServerSignature (data, serverId) {
        // default to this server
        if (!defined(serverId)) {
            serverId = process.env.SERVER_ID
        }
        const server = ServerService.getServerById(serverId)
        // create hmac to sign data
        const hmac = crypto.createHmac('sha256', server.secretBuffer);
        // sign data
        hmac.update(data)
        // create signature
        return hmac.digest('hex')
    }

    /**
     * @function getWebServer
     *
     * get random web server. web servers are not sharded
     *
     * @returns {Promise<object>}
     */
    static getWebServer () {
        // get web servers
        const servers = ServerService.getServers('web')
        // get random server
        return randomItem(servers)
    }

}
