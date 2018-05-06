'use strict'

/* app modules */
const PartnerService = require('../lib/partner-service')
const UserService = require('../lib/user-service')

/* exports */
module.exports = getUser

async function getUser (req, res) {
    // get user
    const user = await UserService.getUser(
        req.headers['x-real-ip'],
        req.query.userId,
        req.headers['x-secret'],
    )
    // record partner time for anon/user - do not wait
    PartnerService.recordPartnerTime(user, req.query.partnerTime).catch(console.error)
    // send user data to client
    res.json(user)
}