'use strict'

/* app modules */
const BlockService = require('../lib/block-service')
const assert = require('../lib/assert')

/* exports */
module.exports = getGet

async function getGet (req, res) {
    assert(req.query.id, 'id required')
    assert(req.query.size, 'size required')

    const block = await BlockService.getBlock(req.query.size, req.query.id)

    if (block && block.urls.length) {
        res.set('Cache-Control', 'public, max-age=21600')
        res.redirect(block.urls[0])
    }
    else {
        res.sendStatus(404)
    }
}