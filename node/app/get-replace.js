'use strict'

/* app modules */
const RedisService = require('../lib/redis-service')
const ReplaceService = require('../lib/replace-service')
const ServerService = require('../lib/server-service')

/* exports */
module.exports = getReplace

async function getReplace (req, res) {
    const replace = await ReplaceService.getReplace(req.query.token)
    // if no replace found then 404
    if (!replace) {
        res.status(404).send()
    }
    // if ids are all zeros this is a soft delete
    else if (replace.deleted) {
        res.json(replace)
    }
    // get download info for replacement blocks
    else {
        const blocks = await RedisService.getBlocks(replace.size, [replace.b0, replace.b1])

        res.json({
            b0: { urls: ServerService.getUrlsForBlock(blocks[0]) },
            b1: { urls: ServerService.getUrlsForBlock(blocks[1]) },
        })
    }
}