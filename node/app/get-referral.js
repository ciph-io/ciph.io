'use strict'

/* app modules */
const ReferralService = require('../lib/referral-service')

/* exports */
module.exports = getReferral

async function getReferral (req, res) {
    // give referral credit if qualified - ignore error
    await ReferralService.giveReferralCredit(
        req.headers['x-real-ip'],
        req.query.u,
    ).catch(console.error)
    // redirect to main page
    res.redirect('/enter')
}