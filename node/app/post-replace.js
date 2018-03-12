'use strict'

/* app modules */
const ReplaceService = require('../lib/replace-service')

/* exports */
module.exports = postReplace

async function postReplace (req, res) {
    await ReplaceService.replace(req.body)

    res.status(204).send()
}