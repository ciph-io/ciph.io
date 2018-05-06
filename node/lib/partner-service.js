'use strict'

/* app modules */
const RedisService = require('./redis-service')
const Type = require('./type')

/* exports */
module.exports = class PartnerService {

    /**
     * @function recordPartnerTime
     *
     * record time attributed to partners for user activity.
     *
     * @param {object} user
     * @param {string} partnerTime
     *
     * @returns {Promise}
     */
    static async recordPartnerTime (user, partnerTime) {
        // if no times provided do nothing
        if (!partnerTime) {
            return
        }
        // get current time
        const time = Date.now()
        // get time of last request
        const lastRequest = user.token.type === 'anon'
            ? await RedisService.getSetAnonLastRequest(user.anonId, time)
            : await RedisService.getSetUserLastRequest(user.userId, time)
        // maximum time to record - either time since last req or 2 seconds
        const maxRecordTime = time - lastRequest < 2000 ? time - lastRequest : 2000
        // get validated and scaled times
        const partnerTimes = PartnerService.getPartnerTimes(partnerTime, maxRecordTime)
        // do nothing if no valid times to record
        if (!partnerTimes.length) {
            return
        }
        // record partner times for either anon or user
        return user.token.type === 'anon'
            ? await RedisService.incrAnonPartnerTimes(partnerTimes)
            : await RedisService.incrUserPartnerTimes(partnerTimes)        
    }

    /**
     * @function getPartnerTimes
     *
     * parse and validate input string of partner userIds and times attributed.
     * scale times to maxRecordTime which is based on either the time since the
     * last user time recording or a hard limit.
     *
     * @param {string} partnerTime
     * @param {integer} maxRecordTime
     *
     * @returns {array}
     */
    static getPartnerTimes (partnerTime, maxRecordTime) {
        // validated times to return
        const validPartnerTimes = []
        // split comma sep list
        const partnerTimes = partnerTime.split(',')
        // track the max reported time
        let maxTime = 0
        // map user ids to times
        for (let i=0; i < partnerTimes.length; i+=2) {
            const userId = partnerTimes[i]
            const time = parseInt(partnerTimes[i+1])
            // require valid values - skip invalid but do not throw
            if (!Type.isValidHex32(userId) || Number.isNaN(time)) {
                continue
            }
            // add validated values
            validPartnerTimes.push(userId, time)
            // track max time
            if (time > maxTime) {
                maxTime = time
            }
        }
        // if the maximum reported time is greater than max allowed time then scale
        // all times relative to the max
        if (maxTime > maxRecordTime) {
            // the ratio of maxTime / diff will be used to scale other times
            const scaleFactor = maxRecordTime / maxTime
            // scale all times
            for (let i=1; i < validPartnerTimes.length; i+=2) {
                validPartnerTimes[i] = parseInt(validPartnerTimes[i] * scaleFactor)
            }
        }

        return validPartnerTimes
    }

}