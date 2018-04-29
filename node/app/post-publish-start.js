'use strict'

/* app modules */
const BlockService = require('../lib/block-service')
const PublishService = require('../lib/publish-service')
const UserService = require('../lib/user-service')

/* exports */
module.exports = postStart

async function postStart (req, res) {
    // get user to check credit
    const user = await UserService.getUser(
        req.headers['x-real-ip'],
        req.body.userId,
        req.body.secret)
    // required credit is 5X number of bytes
    const creditRequired = BlockService.getBytes(req.body.size) * 5
    // require credit
    if (user.credit < creditRequired) {
        res.status(402)
        res.json({error: 'insufficient credit'})
        return
    }
    res.json(
        await PublishService.publishStart(
            parseInt(req.body.size),
            req.body.blockId
        )
    )
}