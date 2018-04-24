(function () {

'use strict'

/* exports */
window.CiphVideoPlayer = class CiphVideoPlayer {

    constructor (videoElmId, videoUrl, browser) {
        this.browser = browser
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

        this.shaka.configure({
            streaming: {
                bufferBehind: 10,
                bufferingGoal: 20,
                rebufferingGoal: 10,
            }
        });

        // wait for head to load
        this.client.head.promise.then(async () => {
            // get mpeg dash index file
            const mpd = this.client.findFile(/\.mpd$/)
            assert(mpd, 'mpeg-dash index file not found')
            // add title to page if defined
            if (this.client.meta && this.client.meta.title) {
                this.browser.setTitle(this.client.meta.title)
            }
            // start shaka player with mpeg-dash index file
            await this.shaka.load(mpd.name).catch(onError)
            // add subtitle files
            if (this.client.meta && Array.isArray(this.client.meta.subtitles)) {
                for (const subtitle of this.client.meta.subtitles) {
                    this.shaka.addTextTrack(subtitle.file, subtitle.language, 'subtitle', 'text/vtt')
                }
            }
        })
    }

}

/* private methods */

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