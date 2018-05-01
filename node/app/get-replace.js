'use strict'

/* npm modules */
const defined = require('if-defined')

/* app modules */
const BlockService = require('../lib/block-service')
const ReplaceService = require('../lib/replace-service')

/* exports */
module.exports = getReplace

async function getReplace (req, res) {
    res.json( await ReplaceService.getReplace(req.query.privateId) )
}