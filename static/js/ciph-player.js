(function () {
    'use strict'

    window.CiphPlayer = CiphPlayer

    function CiphPlayer (videoElmId, videoUrl) {
        this.videoElmId = videoElmId
        this.videoElm = document.getElementById(this.videoElmId)
        this.videoUrl = videoUrl

        if (!window.shaka) {
            console.error('shaka player not loaded')
            return
        }

        if (!this.videoElm) {
            console.error('invalid videoElmId')
            return
        }

        this.shaka = new shaka.Player(this.videoElm)

        this.shaka.getNetworkingEngine()
            .registerRequestFilter(requestFilter.bind(this))
        this.shaka.getNetworkingEngine()
            .registerResponseFilter(responseFilter.bind(this))

        this.shaka.addEventListener('error', onErrorEvent)

        this.shaka.load(videoUrl).catch(onError)
    }

    CiphPlayer.prototype = {

    }

    /* private methods */    

    function onErrorEvent (event) {
        onError(event.detail)
    }

    function onError (error) {
        console.error('Error code', error.code, 'object', error)
    }

    function requestFilter (type, request) {
        console.log('REQUEST FILTER', type, request)

        return request
    }

    function responseFilter (type, response) {
        console.log('RESPONSE FILTER', type, response)

        return response
    }

})()
