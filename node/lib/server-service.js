'use strict'

/* native modules */
const fs = require('fs')

/* app modules */
const assert = require('./assert')

/* load server config file */
const servers = JSON.parse( fs.readFileSync(process.env.SERVER_CONF_FILE, 'utf8') )

/* exports */
module.exports = class ServerService {


    /** @function getServerById
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
        const urls = []

        for (const serverId of block.servers) {
            const server = ServerService.getServerById(serverId)

            urls.push(`${server.url}/download/${block.id.substr(0,2)}/${block.size}/${block.id}.ciph`)
        }

        return urls
    }

}