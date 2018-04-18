'use strict'

/* npm modules */
const fs = require('fs-extra')
const hasha = require('hasha')
const touch = require('touch')

/* app modules */
const BlockService = require('../lib/block-service')
const ServerService = require('./server-service')

// current server
const server = ServerService.getServer()

/* exports */
module.exports = class ProxyService {

    /**
     * @function cacheBlock
     *
     * cache data block if it validates
     *
     * @param {integer|string} size
     * @param {string} blockId
     * @param {Buffer} data
     * 
     * @returns {Promise<object>}
     */
    static async cacheBlock (size, blockId, data) {
        // verify file
        const digest = await hasha(data, {algorithm: 'sha256'})
        // digest must match
        if (digest.substr(0, 32) === blockId) {
            // path of file in cache directory
            const cacheFilePath = ProxyService.getCacheFilePath(size, blockId)
            // save cache file
            await fs.writeFile(cacheFilePath, data)
            // set times on file to match time file
            await touch(cacheFilePath, {ref: server.cacheTimeFile})
        }
        else {
            console.error(`invalid file: ${size}-${blockId}`)
        }
    }

    /**
     * @function getBlockUrl
     *
     * get url for block - url may be on main site or from a proxy server
     *
     * @param {integer|string} size
     * @param {string} blockId
     *
     * @returns {string}
     */
    static getBlockUrl (size, blockId) {
        assert(BlockService.isValidBlockId(blockId), 'invalid blockId')
        assert(BlockService.isValidBlockSize(size), 'invalid size')

        const proxyServer = ServerService.getProxyServer()

        const getPath = proxyServer.type === 'proxy' ? 'get-proxy' : 'get'

        return `${proxyServer.url}/${getPath}/${size}/${blockId}.ciph`
    }

    /**
     * @function getCacheFilePath
     *
     * get path for cache file based on server config
     *
     * @param {integer|string} size
     * @param {string} blockId
     *
     * @returns {string}
     */
    static getCacheFilePath (size, blockId) {
        const prefix = blockId.substr(0, 3)

        let cachePath
        // if server has multiple cache directories get real path
        if (server.cacheDirs) {
            const int = parseInt(prefix, 16)
            cachePath = server.cacheDirs[int % server.cacheDirs.length]
        }
        else {
            cachePath = server.cachePath
        }

        return `${cachePath}/${prefix}/${size}/${blockId}.ciph`
    }
}