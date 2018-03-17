'use strict'

/* app modules */
const BlockService = require('../lib/block-service')

/* exports */
module.exports = getRandom

async function getRandom (req, res) {
    res.json( await BlockService.getRandomBlocks(req.query.size) )
}