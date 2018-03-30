(function () {

'use strict'

window.CiphVideoPlayer = CiphVideoPlayer

function CiphVideoPlayer (videoElmId, videoUrl) {
    this.client = new CiphContainerClient(videoUrl)
    this.videoElmId = videoElmId
    this.videoElm = document.getElementById(this.videoElmId)

    assert(window.shaka, 'shaka player not loaded')
    assert(this.videoElm, 'invalid videoElmId')

    this.shaka = new shaka.Player(this.videoElm)

    // register request plugin - this is global
    shaka.net.NetworkingEngine.registerScheme('https', httpRequest, 99)
    // register request filter which is on the player instance
    // so it can bind the request to this ciph container instance
    this.shaka.getNetworkingEngine()
        .registerRequestFilter(requestFilter.bind(this))

    this.shaka.addEventListener('error', onErrorEvent)

    // this.shaka.addTextTrack('http://dev.ciph.io/test/eng-31055.vtt', 'eng', 'subtitle', 'text/vtt')

    // wait for head to load
    this.client.head.promise.then(() => {
        // get mpeg dash index file
        const mpd = this.client.findFile(/\.mpd$/)
        assert(mpd, 'mpeg-dash index file not found')
        // start shaka player with mpeg-dash index file
        this.shaka.load(mpd.name).catch(onError)
    })
}

CiphVideoPlayer.prototype = {

}

/* private methods */

function assert (isTrue, msg) {
    if (!isTrue) {
        alert(msg)
        throw new Error(msg)
    }
}

async function httpRequest (uri, request, requestType) {
    // split scheme from file
    const [, fileName] = uri.split(':')     
    // get file
    try {
        const data = await request.ciph.client.getFile(fileName)

        return {
            uri: uri,
            data: data,
            headers: {},
            fromCache: false,
        }
    }
    catch (err) {
        return Promise.reject(
            new shaka.util.Error(
                shaka.util.Error.Severity.RECOVERABLE,
                shaka.util.Error.Category.NETWORK,
                shaka.util.Error.Code.HTTP_ERROR,
                uri, err, requestType
            )
        )
    }
}

function onErrorEvent (event) {
    onError(event.detail)
}

function onError (error) {
    console.error('Error code', error.code, 'object', error)
}

function requestFilter (type, request) {
    // and player instance to request
    request.ciph = this
    return request
}

})()