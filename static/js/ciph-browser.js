(function () {

'use strict'

/* globals */
const contentTypes = ['collection', 'page', 'video', 'audio', 'image']

const linkRegExp = /^\d-\d-[a-f0-9]{32}-[a-f0-9]{32}-[a-f0-9]{32}/

const scrollOffsets = {}
// add event handler to capture scroll offset
window.addEventListener('scroll', () => {
    scrollOffsets[location.hash] = window.scrollY
})
// add event listener for url change
window.addEventListener('popstate', () => {
    // hide share when opening new link
    if (window.ciphShare) {
        window.ciphShare.hideQRCode()
    }

    if (location.hash) {
        if (window.ciphBrowser) {
            ciphBrowser.open(location.hash)
        }
    }
    else {
        el('ciph-browser').innerHTML = `
            <h1>Enter a Link or QR code</h1>

            <form id="enter-link">
                <label>Enter Link</label>
                <input type="text" id="enter-link-input" />
                <button type="submit">GO</button>
                <br /><br />
                <label for="enter-link-file">Load QR code from image file</label>
                <input type="file" id="enter-link-file" />
            </form>
        `
        window.ciphEnter = new window.CiphEnter()
    }
})

/* exports */
window.CiphBrowser = class CiphBrowser {

    constructor (args = {}) {
        // initialize browser element where html will be rendered
        this.elmId = args.elmId || 'ciph-browser'
        this.elm = document.getElementById(this.elmId)
        assert(this.elm, 'invalid elmId')
        // content object - depends on content type
        this.active = null
        this.activeContentType = ''
        this.activeLink = ''
        // local storage key for last link access
        this.lastLocalStorageKey = args.lastLocalStorageKey || 'ciph-last'
        // set user and chat client
        this.chat = args.chat || window.ciphChat
        this.partner = args.partner || window.ciphPartner
        this.share = args.share || window.ciphShare
        this.user = args.user || window.ciphUser
        // get ciph link from url
        this.open(location.hash)
    }

    open (link, ev, source) {
        if (ev) {
            ev.preventDefault()
        }
        // hide share when opening new link
        this.share.hideQRCode()
        // parse different link formats
        link = this.parseLink(link)
        // if hash changed then add new url history
        if (link.hash !== location.hash) {
            history.pushState({}, '', link.href)            
        }
        // render link
        this.render(link.link)
    }

    parseLink (orig) {
        const link = {
            orig: orig,
            params: {},
        }
        // extract any params
        if (orig.match(/,/)) {
            const parts = orig.split(',')
            parts.shift()
            for (const part of parts) {
                const [key, val] = part.split('=')
                if (key && val) {
                    link.params[key] = val
                }
            }
        }
        // if link starts with digit then add hash
        if (orig.match(/^\d/)) {
            link.hash = '#'+orig
        }
        else if (orig.match(/^ciph:\/\//)) {
            link.hash = '#'+orig.replace(/^ciph:\/\//, '')
        }
        // otherwise remove everything except hash from link
        else {
            link.hash = orig.replace(/^[^#]*/, '')
        }
        // href includes path
        link.href = `/enter${link.hash}`
        // link is hash with # and any params removed
        link.link = link.hash.substring(1).replace(/,.*/, '')

        return link
    }

    render (link) {
        // do nothing if link is empty string or otherwise not defined
        if (!link) {
            return
        }
        // require valid looking link
        assert(typeof link === 'string' && link.match(linkRegExp), 'invalid link')
        // get content type
        const [, contentTypeNum] = link.split('-')
        const contentType = contentTypes[contentTypeNum]
        assert(contentType, 'invalid content type')
        // empty any existing browser content
        this.elm.innerHTML = ''
        // set active content type
        this.activeContentType = contentType
        this.activeLink = link
        // store last access link
        localStorage.setItem(this.lastLocalStorageKey, this.activeLink)
        // render content type
        switch (contentType) {
            case 'collection':
                this.renderCollection()
                break
            case 'page':
                this.renderPage()
                break
            case 'video':
                this.renderVideo()
                break
            case 'audio':
                this.renderAudio()
                break
            case 'image':
                this.renderImage()
                break
            default:
                throw new Error(`invalid content type ${contentType}`)
        }
        // wait for active content to render
        this.active.renderPromise.then(() => {
            if (this.active.client.meta.title) {
                const onPage = !(this.active.markdown && this.active.markdown.match(/^#[^#]/m))
                this.setTitle(this.active.client.meta.title, onPage)
            }
        })
    }

    renderAudio () {
        assert(false, 'audio not yet supported')
    }

    renderCollection () {
        // create page container
        this.elm.innerHTML = `<div id="ciph-page"></div>`
        // create page viewer
        this.active = new CiphCollectionViewer({
            browser: this,
            link: this.activeLink,
        })
        // after render restore scroll
        this.active.renderPromise.then(() => {
            if (scrollOffsets[location.hash]) {
                window.scrollTo(0, scrollOffsets[location.hash])
            }
            else {
                window.scrollTo(0, 0)
            }
        })
    }

    renderImage () {
        assert(false, 'image not yet supported')
    }

    renderPage () {
        // create page container
        this.elm.innerHTML = `<div id="ciph-page"></div>`
        // create page viewer
        this.active = new CiphPageViewer({
            browser: this,
            link: this.activeLink,
        })
        // after render restore scroll
        this.active.renderPromise.then(() => {
            if (scrollOffsets[location.hash]) {
                window.scrollTo(0, scrollOffsets[location.hash])
            }
            else {
                window.scrollTo(0, 0)
            }
        })
    }

    renderVideo () {
        // create video tag
        this.elm.innerHTML = `<video id="ciph-video" controls></video>`
        // create video player
        this.active = new CiphVideoPlayer({
            browser: this,
            link: this.activeLink,
        })
        // always scroll to top
        window.scrollTo(0, 0)
    }

    setTitle (title, onPage) {
        // add title to page
        if (onPage !== false) {
            const titleElm = document.createElement('h1')
            titleElm.appendChild(document.createTextNode(title))
            this.elm.insertBefore(titleElm, this.elm.childNodes[0])
        }

        document.title = title
    }
}

})()