'use strict'

/* app modules */
const PublishService = require('../lib/publish-service')

/* exports */
module.exports = postFinish

async function postFinish (req, res) {
    await PublishService.publishFinish(
        parseInt(req.body.size),
        req.body.blockId,
        req.body.serverId,
        req.body.signature
    )
    res.json({published: true})
}