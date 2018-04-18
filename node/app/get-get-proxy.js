'use strict'

/* npm modules */
const request = require('request')

/* app modules */
const ProxyService = require('../lib/proxy-service')

/* exports */
module.exports = getGetProxy

const pathRegExp = /\/(\d+)\/([a-z0-9]{32})\.ciph$/

async function getGetProxy (req, res) {
    assert(req.query.path, 'path required')
    // extract size and id from path
    const [, size, blockId] = req.query.path.match(pathRegExp)
    // initiate request
    const blockRequest = request({
        encoding: null,
        forever: true,
        uri: ProxyService.getBlockUrl(size, blockId),
    }, (err, response) => {
        if (err) {
            console.error(err)
        }
        else {
            ProxyService.cacheBlock(size, blockId, response.body).catch(console.error)
        }
    })
    // pipe response to client
    blockRequest.pipe(res)
}
