'use strict'

/* app modules */
const BlockService = require('./block-service')
const RedisService = require('./redis-service')
const ServerService = require('./server-service')
const assert = require('./assert')

/* exports */
module.exports = class PublishService {

    /**
     * @function publishStart
     *
     * get server to publish block to and create temporary entry for block
     * indicating that upload is in progress.
     *
     * size + blockId is signed with server secret and server will reject
     * upload unless signature is valid.
     *
     * @param {integer|string} size
     * @param {string} blockId
     * 
     * @returns {Promise<object>}
     */
    static async publishStart (size, blockId) {
        assert(BlockService.isValidBlockSize(size), 'invalid size')
        assert(BlockService.isValidBlockId(blockId), 'invalid blockId')
        // set new key for block only if not set - throws on error
        await RedisService.createNewBlock(size, blockId)
        // get upload server for block
        const server = ServerService.getDataServer(blockId)
        // sign size and block id to authorize upload for server
        const signature = ServerService.getServerSignature(size+blockId, server.id)

        return {
            url: `${server.url}/upload`,
            signature: signature,
        }
    }

    /**
     * @function publishFinish
     *
     * takes signed size+serverId+blockId and adds server to block
     *
     * @param {integer|string} size
     * @param {string} blockId
     * @param {string} serverId
     * @param {string} requestSignature
     *
     * @returns {Promise<undefined>}
     */
    static async publishFinish (size, blockId, serverId, requestSignature) {
        assert(BlockService.isValidBlockSize(size), 'invalid size')
        assert(BlockService.isValidBlockId(blockId), 'invalid blockId')
        // get existing block entry
        const blockServers = await RedisService.getBlockServers(size, blockId)
        assert(blockServers.servers[0] === 'U', 'invalid upload')
        // validate signature
        const signature = ServerService.getServerSignature(size+blockId+serverId, serverId)
        assert(signature === requestSignature, 'invalid signature')
        // set server for block
        await RedisService.setServers(size, blockId, [serverId])
    }

}