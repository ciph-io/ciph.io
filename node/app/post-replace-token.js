'use strict'

/* app modules */
const ReplaceService = require('../lib/replace-service')

/* exports */
module.exports = postReplaceToken

async function postReplaceToken (req, res) {
    res.json( await ReplaceService.createReplaceToken(
        req.body.privateId,
        req.body.token
    ) )
}