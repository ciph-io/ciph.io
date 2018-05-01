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
    if (window.ciphBrowser) {
        ciphBrowser.render(location.hash)
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
        this.user = args.user || window.ciphUser
        // get ciph link from url
        this.render(location.hash)
    }

    open (link, ev) {
        if (ev) {
            ev.preventDefault()
        }
        if (link.match(/^ciph:\/\//)) {
            link = '/enter#' + link.replace(/^ciph:\/\//, '')
        }
        history.pushState({}, '', link)
        this.render(link)
        return false
    }

    render (link) {
        link = link.replace(/^.*?#/, '')
        // if there is no link then go to last link if set
        if (link.length === 0) {
            link = localStorage.getItem(this.lastLocalStorageKey)
            // if link is loaded then must add to history
            if (link) {
                history.pushState({}, '', `/enter#${link}`)
            }
            else {
                return
            }
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
                return this.renderCollection()
            case 'page':
                return this.renderPage()
            case 'video':
                return this.renderVideo()
            case 'audio':
                return this.renderAudio()
            case 'image':
                return this.renderImage()
        }
    }

    renderAudio () {
        assert(false, 'audio not yet supported')
    }

    renderCollection () {
        assert(false, 'collection not yet supported')
    }

    renderImage () {
        assert(false, 'image not yet supported')
    }

    renderPage () {
        // create page container
        this.elm.innerHTML = `<div id="ciph-page"></div>`
        // create page viewer
        this.active = new CiphPageViewer('ciph-page', this.activeLink, this)
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
        this.active = new CiphVideoPlayer('ciph-video', this.activeLink, this)
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