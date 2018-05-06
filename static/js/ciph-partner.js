(function () {

/* exports */
window.CiphPartner = class CiphPartner {

    constructor (args = {}) {
        this.active = null
        this.partnerTime = {}
        this.referrers = []
    }

    getPartnerTime () {
        // if there is active container record and reset
        if (this.active) {
            this.recordPartnerTime(this.active, .7)
            this.active = this.newActive(this.active.userId)
        }
        // if there are referrers record and place
        if (this.referrers[0]) {
            this.recordPartnerTime(this.referrers[0], .2)
            this.referrers[0] = this.newActive(this.referrers[0].userId)
        }
        if (this.referrers[1]) {
            this.recordPartnerTime(this.referrers[1], .1)
            this.referrers[1] = this.newActive(this.referrers[1].userId)
        }
        // capture reference to existing partner time records
        const partnerTime = this.partnerTime
        // reset partner time
        this.partnerTime = {}
        // return old partner time to be recorded
        return partnerTime
    }

    getPartnerTimeArray () {
        const partnerTimeArray = []
        const partnerTime = this.getPartnerTime()
        
        for (const userId of Object.keys(partnerTime)) {
            partnerTimeArray.push(userId, partnerTime[userId])
        }

        return partnerTimeArray
    }

    newActive (userId) {
        return {
            userId: userId,
            time: Date.now(),
        }
    }

    recordPartnerTime (active, factor) {
        if (!active) {
            return
        }
        // get time in ms that partner was active for
        const activeTime = Date.now() - active.time
        // create entry for partner if not set
        if (!this.partnerTime[active.userId]) {
            this.partnerTime[active.userId] = 0
        }
        // add partner time modified by factor that is set
        // based on whether this is active or referrer
        this.partnerTime[active.userId] += parseInt(activeTime * factor) 
    }

    setActiveUserId (userId) {
        // record time for previous active partner if set
        this.recordPartnerTime(this.active, .7)
        // set the active user id
        this.active = this.newActive(userId)
    }

    setReferrerUserId (userId) {
        // if user is already top referrer then do not change
        if (this.referrers[0] && this.referrers[0].userId === userId) {
            return
        }
        // make user first referrer
        this.referrers.unshift(this.newActive(userId))
        // limit referrers to 2
        if (this.referrers.length > 2) {
            // record time for referrer being removed
            this.recordPartnerTime(this.referrers.pop(), .1)
        }
        // if there is a second referrer it got bumped from first
        // so need to record and reset time
        if (this.referrers.length === 2) {
            this.recordPartnerTime(this.referrers[1], .2)
            this.referrers[1] = this.newActive(this.referrers[1].userId)
        }
    }

}

})()