'use strict'

/* app modules */
const RedisService = require('../lib/redis-service')
const ServerService = require('../lib/server-service')

/* exports */
module.exports = getBlock

async function getBlock (req, res) {
    const block = await RedisService.getBlock(req.query.size, req.query.id)

    res.json({
        urls: ServerService.getUrlsForBlock(block)
    })
}