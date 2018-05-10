(function () {

'use strict'

/* exports */
window.CiphVideoPlayer = class CiphVideoPlayer {

    constructor (args = {}) {
        // require shaka player to be loaded
        assert(window.shaka, 'shaka player not loaded')
        // initialize video element
        this.videoElmId = args.videoElmId || 'ciph-video'
        this.videoElm = document.getElementById(this.videoElmId)
        assert(this.videoElm, 'invalid videoElmId')
        // ciph browser object
        this.browser = args.browser || window.ciphBrowser
        // create new container client for link
        this.client = new CiphContainerClient(args.link)
        // resume from prior playack position (default true)
        this.resume = args.resume === false ? false : true
        // local storage key for storing playback status
        this.statusLocalStorageKey = ''

        // create new shaka player instance
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
            // local storage key for playback status
            this.statusLocalStorageKey = `${this.client.publicId}-status`
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
            // play video when ready
            this.videoElm.addEventListener('loadedmetadata', () => {
                // check if status is set
                const previousTime = localStorage.getItem(this.statusLocalStorageKey)
                // if time is set then check if user wants to resume from previous
                if (this.resume && previousTime) {
                    const minutes = Math.floor(previousTime/60)
                        .toString().padStart(2, '0')
                    const seconds = Math.floor(previousTime - minutes * 60)
                        .toString().padStart(2, '0')
                    if (confirm(`Playback in progress. Click OK to resume from ${minutes}:${seconds} or Cancel to start from beginning.`)) {
                        this.videoElm.currentTime = parseInt(previousTime)
                    }
                    localStorage.removeItem(this.statusLocalStorageKey)
                }
                // play video
                this.videoElm.play()
            })
            // add event handler to pause video when tab hidden
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.videoElm.pause()
                }
            })
            // add event handler to keep track of position in video
            this.videoElm.addEventListener('timeupdate', ev => {
                // if video has reached end then delete status
                if (this.videoElm.currentTime === this.videoElm.duration) {
                    localStorage.removeItem(this.statusLocalStorageKey)
                }
                // otherwise store current status
                else {
                    localStorage.setItem(this.statusLocalStorageKey, this.videoElm.currentTime)
                }
            })
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