'use strict'

/* npm modules */
const fs = require('mz/fs')
const hasha = require('hasha')
const touch = require('touch')

/* app modules */
const BlockService = require('./block-service')
const ServerService = require('./server-service')

/* globals */
const blockSizes = BlockService.getBlockSizes()

/* exports */
module.exports = class UploadService {

    static async processUpload (args, file) {
        try {
            // validate signature
            const requestSignature = ServerService.getServerSignature(args.size+args.blockId)
            assert(requestSignature === args.signature, 'invalid signature')
            // validate size
            assert(blockSizes[args.size] === file.size, 'invalid size')
            // validate block id
            const hash = await hasha.fromFile(file.path, {algorithm: 'sha256'})
            assert(hash.substr(0,32) === args.blockId, 'invalid upload')
            // get path for file
            const blockPath = BlockService.getBlockPath(args.size, args.blockId)
            // set times on file to match time file
            await touch(file.path, {ref: blockPath.timeFilePath})
            // move file into place
            await fs.copyFile(file.path, blockPath.blockFilePath)
            // set times on file to match time file
            await touch(blockPath.blockFilePath, {ref: blockPath.timeFilePath})
            // delete upload file
            await fs.unlink(file.path)
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