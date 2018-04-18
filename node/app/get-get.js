'use strict'

/* app modules */
const BlockService = require('../lib/block-service')

/* exports */
module.exports = getGet

async function getGet (req, res) {
    let id = req.params.id
    id = id.substr(0, id.length - 5)
    const size = req.params.size

    const block = await BlockService.getBlock(size, id)

    if (block && block.urls.length) {
        res.set('Cache-Control', 'public, max-age=21600')
        res.redirect(block.urls[0])
    }
    else {
        res.sendStatus(404)
    }
}