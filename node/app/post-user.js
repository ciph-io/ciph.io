'use strict'

/* app modules */
const UserService = require('../lib/user-service')

/* exports */
module.exports = postUser

async function postUser (req, res) {
    res.json(
        await UserService.createUser(
            req.headers['x-real-ip'],
            req.body.userId,
            req.body.secret
        )
    )
}