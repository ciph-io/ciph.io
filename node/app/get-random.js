'use strict'

/* app modules */
const RedisService = require('../lib/redis-service')
const ServerService = require('../lib/server-service')

/* exports */
module.exports = getRandom

async function getRandom (req, res) {
    const randomBlock = await RedisService.getRandomBlock(req.query.size)

    res.json({
        urls: ServerService.getUrlsForBlock(randomBlock)
    })
}