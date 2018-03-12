'use strict'

module.exports = function (assert, message) {
    if (!assert) {
        const error = new Error(message)
        error.code = 400
        throw error
    }
}