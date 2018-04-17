'use strict'

/* native modules */
const fs = require('fs-extra')
const hasha = require('hasha')
const request = require('request')
const touch = require('touch')

/* app modules */
const BlockService = require('../lib/block-service')
const assert = require('../lib/assert')

/* exports */
module.exports = getGetProxy

const pathRegExp = /\/(\d+)\/([a-z0-9]{32})\.ciph$/

async function getGetProxy (req, res) {
    assert(req.query.path, 'path required')
    // extract size and id from path
    const [, size, id] = req.query.path.match(pathRegExp)

    assert(BlockService.isValidBlockId(id), 'invalid id')
    assert(BlockService.isValidBlockSize(size), 'invalid size')

    const blockUrl = `${process.env.API_HOST}/get/${size}/${id}.ciph`
    // save file to tmp directory
    const tmpFilePath = `${process.env.CACHE_TMP_PATH}/${size}-${id}.ciph`
    // path of file in cache directory
    const cacheFilePath = `${process.env.CACHE_PATH}/${id.substr(0,3)}/${size}/${id}.ciph`
    // initiate request
    const blockRequest = request({
        encoding: null,
        forever: true,
        url: blockUrl,
    }, async (err, response) => {
        if (err) {
            console.error(err)
            return
        }
        // verify file
        const digest = await hasha(response.body, {algorithm: 'sha256'})
        // digest must match
        if (digest.substr(0, 32) === id) {
            // save cache file
            await fs.writeFile(cacheFilePath, response.body)
            // set times on file to match time file
            await touch(cacheFilePath, {ref: process.env.CACHE_TIME_FILE_PATH})
        }
        else {
            console.error(`invalid file: ${blockUrl}`)
        }
    })
    // pipe response to client
    blockRequest.pipe(res)
}
