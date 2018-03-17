'use strict'

/* app modules */
const BlockService = require('../lib/block-service')
const assert = require('../lib/assert')

/* exports */
module.exports = getBlocks

async function getBlocks (req, res) {
    assert(req.query.ids, 'ids required')
    assert(req.query.size, 'size required')
    res.json( await BlockService.getBlocks(req.query.size, req.query.ids.split(',')) )
}