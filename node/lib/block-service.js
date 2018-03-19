'use strict'

/* npm modules */
const defined = require('if-defined')

/* app modules */
const RedisService = require('./redis-service')
const ServerService = require('./server-service')

/* globals */

const KB = 1024
const MB = 1024*KB

const blockIdRegExp = /^[0-9a-f]{32}$/
const blockSizes = [ 4KB, 16KB, 64KB, 256*KB, 1*MB, 4*MB, 16*MB ]

/* exports */
module.exports = class BlockService {

    static async getBlock (size, id) {
        const block = await RedisService.getBlockServers(size, id)
        return { urls: ServerService.getUrlsForBlock(block) }
    }

    static async getBlocks (size, ids) {
        const results = await RedisService.getBlockServersMulti(size, ids)
        // map of blocks keyed by id
        const blocks = {}
        // map results to blocks
        for (const result of results) {
            if (result) {
                blocks[result.id] = {
                    urls: ServerService.getUrlsForBlock(result)
                }
            }
        }

        return blocks
    }

    static async getRandomBlocks (size) {
        const blockServers = await RedisService.getRandomBlockServers(size)

        const results = []

        for (const blockServer of blockServers) {
            if (blockServer === null) continue

            results.push({
                blockId: blockServer.id,
                urls: ServerService.getUrlsForBlock(blockServer),
            })
        }

        return results
    }

    static isValidBlockId (blockId) {
        return typeof blockId === 'string' && blockId.match(blockIdRegExp)
    }

    static isValidBlockSize (size) {
        return defined(blockSizes[size])
    }

}