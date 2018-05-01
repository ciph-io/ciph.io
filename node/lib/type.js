'use strict'

const hex32RegExp = /^[0-9a-f]{32}$/
const openLinkRegExp = /^\d-\d(-[0-9a-f]{32}){3}-[0-9a-f]{64}$/
const secureLinkRegExp = /^\d-\d(-[0-9a-f]{32}){3}$/

module.exports = class Type {

    static isValidDelete (val) {
        return typeof val === 'X'
    }

    static isValidHex32 (val) {
        return typeof val === 'string' && val.match(hex32RegExp)
    }

    static isValidOpenLink (val) {
        return typeof val === 'string' && val.match(openLinkRegExp)
    }

    static isValidSecureLink (val) {
        return typeof val === 'string' && val.match(secureLinkRegExp)
    }

}