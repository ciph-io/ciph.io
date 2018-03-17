'use strict'

/* npm modules */
const defined = require('if-defined')

/* app modules */
const BlockService = require('../lib/block-service')
const ReplaceService = require('../lib/replace-service')

/* exports */
module.exports = getReplace

async function getReplace (req, res) {
    const replace = await ReplaceService.getReplace(req.query.token)
    // if no replace found then 404
    if (!replace) {
        res.status(404).send()
    }
    // if ids are all zeros this is a soft delete
    else if (replace.deleted) {
        res.json(replace)
    }
    // get download info for replacement blocks
    else {
        // get replacement blocks
        const blocks = await BlockService.getBlocks(replace.size, [replace.b0, replace.b1])
        // ids are not validated when set so one or both may not exist
        if (defined(blocks[replace.b0]) && defined(blocks[replace.b1])) {
            res.json([ blocks[replace.b0].urls, blocks[replace.b1].urls ])
        }
        // otherwise 404
        else {
            res.status(404).send()
        }
    }
}