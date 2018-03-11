'use strict'

module.exports = errorWrapper

/**
 * @function errorWrapper
 *
 * return function that wraps passed in function with an error handler
 */
function errorWrapper (func) {
    return async function (req, res, next) {
        try {
            await func(req, res)
        }
        catch (err) {
            next(err)
        }
    }
}