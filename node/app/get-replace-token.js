'use strict'

/* app modules */
const ReplaceService = require('../lib/replace-service')

/* exports */
module.exports = getReplaceToken

async function getReplaceToken (req, res) {
    res.json( await ReplaceService.createReplaceToken() )
}