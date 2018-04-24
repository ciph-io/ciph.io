'use strict'

/* app modules */
const UserService = require('../lib/user-service')

/* exports */
module.exports = getUser

async function getUser (req, res) {
    res.json(
        await UserService.getUser(
            req.headers['x-real-ip'],
            req.query.userId,
            req.headers['x-secret']
        )
    )
}