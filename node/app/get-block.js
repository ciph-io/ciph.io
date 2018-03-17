'use strict'

/* app modules */
const BlockService = require('../lib/block-service')

/* exports */
module.exports = getBlock

async function getBlock (req, res) {
    res.json( await BlockService.getBlock(req.query.size, req.query.id) )
}