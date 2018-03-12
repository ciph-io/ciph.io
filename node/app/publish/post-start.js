'use strict'

/* exports */
module.exports = postStart

async function postStart (req, res) {
    // return url to upload to
    res.json({
        url: `${process.env.PROTOCOL}://${process.env.HOST}/upload`
    })
}