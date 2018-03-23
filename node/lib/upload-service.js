'use strict'

/* npm modules */
const fs = require('mz/fs')
const hasha = require('hasha')

/* app modules */
const BlockService = require('./block-service')
const ServerService = require('./server-service')
const assert = require('./assert')

/* globals */
const blockSizes = BlockService.getBlockSizes()

/* exports */
module.exports = class UploadService {

    static async processUpload (args, file) {
        try {
            // validate signature
            const requestSignature = ServerService.getServerSignature(args.size+args.blockId+args.time)
            assert(requestSignature === args.signature, 'invalid signature')
            // get time since signature issued in seconds
            const elapsed = (Date.now() - args.time) / 1000
            // expire after 60 seconds
            assert(elapsed < 60, 'signature expired')
            // validate size
            assert(blockSizes[args.size] === file.size, 'invalid size')
            // validate block id
            const hash = await hasha.fromFile(file.path, {algorithm: 'sha256'})
            assert(hash.substr(0,32) === args.blockId, 'invalid upload')
            // get path for file
            const path = `${process.env.DATA_ROOT}/${args.blockId.substr(0, 2)}/${args.size}/${args.blockId}.ciph`
            // move file into place
            await fs.rename(file.path, path)
            // create signature with server id and block id
            const serverId = process.env.SERVER_ID
            const signature = ServerService.getServerSignature(args.size+args.blockId+serverId)

            return { serverId, signature }
        }
        catch (err) {
            // delete uploaded file on error
            fs.unlink(file.path).catch(console.error)
            throw err
        }

    }

}