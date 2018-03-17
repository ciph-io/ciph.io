'use strict'

/* native modules */
const fs = require('fs')

/* npm modules */
const crypto = require('mz/crypto')
const defined = require('if-defined')
const randomInt = require('random-int')

/* app modules */
const RedisService = require('./redis-service')
const assert = require('./assert')

// load server config file
const servers = JSON.parse( fs.readFileSync(process.env.SERVER_CONF_FILE, 'utf8') )
// convert secrets to buffers
for (const server of servers) {
    server.secretBuffer = Buffer.from(server.secret, 'hex')
}

/* exports */
module.exports = class ServerService {

    /**
     * @function getUploadServer
     *
     * get server to upload to
     *
     * @param {integer} size
     * @param {string} blockId
     *
     * @returns {Promise<object>}
     */
    static getUploadServer (size, blockId) {
        // get random server - could also be partitioned on block id
        return servers[ randomInt(0, servers.length-1) ]
    }

    /**
     * @function getBlockUrlForServer
     *
     * get block download user for server
     *
     * @param {string} size
     * @param {string} blockId
     * @param {string} serverId
     *
     * @returns {string}
     */
    static getBlockUrlForServer (size, blockId, serverId) {
        // default to current server
        if (!defined(serverId)) {
            serverId = process.env.SERVER_ID
        }
        const server = ServerService.getServerById(serverId)

        return `${server.url}/download/${blockId.substr(0, 2)}/${size}/${blockId}.ciph`
    }

    /**
     * @function getServer
     *
     * get current server based on env SERVER_ID
     *
     *  @returns {object}
     */
    static getServer () {
        return getServerById(process.env.SERVER_ID)
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
        assert(servers[id], 'invalid server id')

        return servers[id]
    }

    /**
     * @function getUrlsForBlock
     *
     * return list of urls built from block data
     *
     * @param {object} block
     * @param {string} block.id
     * @param {array}  block.servers
     * @param {string} block.size
     *
     * @return {array}
     */
    static getUrlsForBlock (block) {
        return block.servers.map(serverId =>
            ServerService.getBlockUrlForServer(block.size, block.id, serverId))
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

}