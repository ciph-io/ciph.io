'use strict'

/* native modules */
const path = require('path')


/* app modules */
const RedisService = require('./redis-service')
const ServerService = require('./server-service')
const sha256 = require('./util/sha-256')

/* globals */

const KB = 1024
const MB = 1024*KB

// block id must be 32 char lower case hex
const blockIdRegExp = /^[0-9a-f]{32}$/
// block sizes in bytes
const blockSizes = [ 4*KB, 16*KB, 64*KB, 256*KB, 1*MB, 4*MB, 16*MB ]

/* exports */
module.exports = class BlockService {

    /**
     * @function getBlock
     *
     * get info for block
     *
     * @param {integer|string} size
     * @param {string} blockId
     *
     * @returns Promise<object>
     */
    static async getBlock (size, blockId) {
        const block = await RedisService.getBlockServers(size, blockId)

        return { urls: BlockService.getUrlsForBlock(block) }
    }

    /**
     * @function getBlockId
     *
     * get first 32 bytes of sha-256 hex hash of data
     *
     * @param {Buffer} data
     *
     * @returns {string}
     */
    static getBlockId (data) {
        return sha256(data, 'hex').substr(0, 32)
    }

    /**
     * @function getBlockPath
     *
     * get abs server path for block file and path to time file
     *
     * @param {integer|string} size
     * @param {string} blockId
     * @param {string} serverId
     *
     * @returns {object}
     */
    static getBlockPath (size, blockId, serverId) {
        assert(BlockService.isValidBlockId(blockId), 'invalid blockId')
        assert(BlockService.isValidBlockSize(size), 'invalid size')
        // get server by id or current server
        const server = defined(serverId)
            ? ServerService.getServerById(serverId)
            : ServerService.getServer()
        // get block prefix for server
        const prefix = blockId.substr(0, server.shardPrefix)
        // convert hex prefix to integer
        const int = parseInt(prefix, 16)
        // check that server provides shard that block is in
        assert(int % server.shards === server.shard, 'invalid shard')
        // get data dir for block
        const dataDir = BlockService.getDataDir(int, server)

        return {
            blockFilePath: path.resolve(dataDir, prefix, size.toString(), `${blockId}.ciph`),
            timeFilePath: path.resolve(dataDir, 'time.file')
        }
    }

    /**
     * @function getBlockSizes
     *
     * return array of block sizes in bytes
     *
     * @returns {array}
     */
    static getBlockSizes () {
        return blockSizes
    }

    /**
     * @function getBlockUrl
     *
     * get download url for block
     *
     * @param {integer|string} size
     * @param {string} blockId
     * @param {string} serverId
     *
     * @returns {string}
     */
    static getBlockUrl (size, blockId, serverId) {
        assert(BlockService.isValidBlockId(blockId), 'invalid blockId')
        assert(BlockService.isValidBlockSize(size), 'invalid size')
        // get server by id or current server
        const server = defined(serverId)
            ? ServerService.getServerById(serverId)
            : ServerService.getServer()
        // build full url for data servers
        if (server.type === 'data') {
            // get block prefix for server
            const prefix = blockId.substr(0, server.shardPrefix)
            // convert hex prefix to integer
            const prefixInt = parseInt(prefix, 16)
            // check that server provides shard that block is in
            assert(prefixInt % server.shards === server.shard, 'invalid shard')

            // if there are multiple data dirs then include in url
            if (server.numDataDirs > 1) {
                // bucket prefix dirs into data dirs sequenitally
                const dataDirNum = Math.floor(prefixInt / (server.shardDirs / server.numDataDirs))

                return `${server.url}/download/${dataDirNum}/${prefix}/${size}/${blockId}.ciph`
            }
            else {
                return `${server.url}/download/${prefix}/${size}/${blockId}.ciph`
            }
        }
        // use generic download path for other servers
        else {
            return `${server.url}/download?size=${size}&blockId=${blockId}`
        }
    }

    /**
     * @function getBlocks
     *
     * get info for blocks
     *
     * @param {integer|string} size
     * @param {array} blockIds
     *
     * @returns Promise<array>
     */
    static async getBlocks (size, blockIds) {
        const results = await RedisService.getBlockServersMulti(size, blockIds)
        // map of blocks keyed by id
        const blocks = {}
        // map results to blocks
        for (const result of results) {
            if (result) {
                blocks[result.id] = {
                    urls: BlockService.getUrlsForBlock(result)
                }
            }
        }

        return blocks
    }

    /**
     * @function getBytes
     *
     * get bytes for block size
     *
     * @param {integer|string} size
     *
     * @returns {integer}
     */
    static getBytes (size) {
        assert(defined(blockSizes[size]), 'invalid block size')
        return blockSizes[size]
    }

    /**
     * @function getDataDir
     *
     * get data dir for server based on prefix of block as integer
     *
     * @param {integer} prefixInt
     * @param {object} server
     *
     * @returns {string}
     */
    static getDataDir (prefixInt, server) {
        // bucket prefix dirs into data dirs sequenitally
        const dataDirNum = Math.floor(prefixInt / (server.shardDirs / server.numDataDirs))

        return server.dataDirs[dataDirNum]
    }

    /**
     * @function getRandomBlocks
     *
     * get a list of random blocks of given size
     *
     * @param {integer|string} size
     *
     * @returns Promise<array>
     */
    static async getRandomBlocks (size) {
        return RedisService.getRandomBlockIds(size)
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
        return block.servers.map(
            serverId => BlockService.getBlockUrl(block.size, block.id, serverId)
        )
    }

    static isValidBlockId (blockId) {
        return typeof blockId === 'string' && blockId.match(blockIdRegExp)
    }

    static isValidBlockSize (size) {
        return defined(blockSizes[size])
    }

}