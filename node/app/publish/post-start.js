'use strict'

/* npm modules */
const getEnv = require('get-env')

/* exports */
module.exports = postStart

/* globals */
const protocol = getEnv() === 'prod' ? 'https' : 'http'

async function postStart (req, res) {
    // return url to upload to
    res.json({
        url: `${protocol}://${process.env.HOST}/upload`
    })
}