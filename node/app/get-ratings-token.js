'use strict'

/* app modules */
const RatingsService = require('../lib/ratings-service')

/* exports */
module.exports = getRatingsToken

async function getRatingsToken (req, res) {
    res.json( await RatingsService.createRatingsToken() )
}