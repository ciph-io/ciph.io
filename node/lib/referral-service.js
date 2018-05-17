'use strict'

/* app modules */
const RedisService = require('./redis-service')
const UserService = require('./user-service')

/* exports */
module.exports = class ReferralService {

    /**
     * @function giveReferralCredit
     *
     * give referral credit to anon and referring user if qualified.
     *
     * @param {string} ip
     * @param {string} userId
     *
     * @returns {Promise<object>}
     */
    static async giveReferralCredit (ip, userId) {
        const anonId = UserService.getAnonId(ip)

        return RedisService.giveReferralCredit(anonId, userId)
    }

}