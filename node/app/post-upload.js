'use strict'

/* app modules */
const UploadService = require('../lib/upload-service')

/* exports */
module.exports = postUpload

async function postUpload (req, res) {
    res.json( await UploadService.processUpload(req.body, req.file) )
}