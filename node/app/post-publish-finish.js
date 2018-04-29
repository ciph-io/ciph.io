'use strict'

/* app modules */
const BlockService = require('../lib/block-service')
const PublishService = require('../lib/publish-service')
const RedisService = require('../lib/redis-service')
const UserService = require('../lib/user-service')

/* exports */
module.exports = postFinish

async function postFinish (req, res) {
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
    // consume anon credit
    if (user.token.type === 'anon') {
        await RedisService.decrAnonCredit(user.anonId, creditRequired)
    }
    // consume user credit
    else {
        await RedisService.decrUserCredit(user.userId, creditRequired)
    }
    // create entry for published block
    await PublishService.publishFinish(
        parseInt(req.body.size),
        req.body.blockId,
        req.body.serverId,
        req.body.signature
    )
    res.json({published: true})
}