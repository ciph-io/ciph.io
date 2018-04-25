'use strict'

/* npm modules */
const randomItem = require('random-item')

/* app modules */
const BlockService = require('../lib/block-service')
const ServerService = require('../lib/server-service')

/* exports */
module.exports = getGet

async function getGet (req, res) {
    // key must be provided to download
    assert(req.query.key === ServerService.getDownloadKey(), 'invalid key')
    // get id from path
    let id = req.params.id
    // remove .ciph extension
    id = id.substr(0, id.length - 5)
    // get size from path
    const size = req.params.size

    const block = await BlockService.getBlock(size, id)
    const url = `${randomItem(block.urls)}?key=${req.query.key}`

    if (block && block.urls.length) {
        res.set('Cache-Control', 'public, max-age=21600')
        res.redirect(url)
    }
    else {
        res.sendStatus(404)
    }
}