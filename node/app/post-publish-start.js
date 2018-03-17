'use strict'

/* app modules */
const PublishService = require('../lib/publish-service')

/* exports */
module.exports = postStart

async function postStart (req, res) {
    res.json(
        await PublishService.publishStart(
            parseInt(req.body.size),
            req.body.blockId
        )
    )
}