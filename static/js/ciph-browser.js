(function () {

'use strict'

/* exports */
window.CiphBrowser = CiphBrowser

/* globals */
const contentTypes = ['collection', 'page', 'video', 'audio', 'image']

const linkRegExp = /^\d-\d-[a-f0-9]{32}-[a-f0-9]{32}-[a-f0-9]{32}/

const scrollOffsets = {}

window.addEventListener('scroll', ev => {
    // store scroll offset so it can be restored when going back
    scrollOffsets[location.hash] = window.scrollY
})

function CiphBrowser (browserElmId) {
    // initialize browser element where html will be rendered
    this.browserElmId = browserElmId
    this.browserElm = document.getElementById(this.browserElmId)
    assert(this.browserElm, 'invalid browserElmId')
    // content object - depends on content type
    this.active = null
    this.activeContentType = ''
    this.activeLink = ''
    // get ciph link from url
    this.render(location.hash)
    // add event listener for url change
    window.addEventListener('popstate', popStateHandler)
}

CiphBrowser.prototype = {
    open,
    render,
    renderAudio,
    renderCollection,
    renderImage,
    renderPage,
    renderVideo,
    setTitle,
}

function open (link) {
    if (link.match(/^ciph:\/\//)) {
        link = link.replace(/^ciph:\/\//, '')
        // get block ids
        const [,,blockId0, blockId1] = link.split('-')

        crypto.subtle.digest(
            { name: 'SHA-256' },
            bufferFromHex(blockId0+blockId1)
        ).then(digest => {
            const httpLink = `/enter?ciph=${bufferToHex(digest)}#${link}`
            history.pushState({}, '', httpLink)
            this.render(link)
        })
    }
    else {
        history.pushState({}, '', link)
        this.render(link)
    }
}

function render (link) {
    link = link.replace(/^.*?#/, '')
    // require valid looking link
    assert(typeof link === 'string' && link.match(linkRegExp), 'invalid link')
    // get content type
    const [, contentTypeNum] = link.split('-')
    const contentType = contentTypes[contentTypeNum]
    assert(contentType, 'invalid content type')
    // empty any existing browser content
    this.browserElm.innerHTML = ''
    // set active content type
    this.activeContentType = contentType
    this.activeLink = link
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

function renderAudio () {
    assert(false, 'audio not yet supported')
}

function renderCollection () {
    assert(false, 'collection not yet supported')
}

function renderImage () {
    assert(false, 'image not yet supported')
}

function renderPage () {
    // create page container
    this.browserElm.innerHTML = `<div id="ciph-page"></div>`
    // create page viewer
    this.active = new CiphPageViewer('ciph-page', this.activeLink, this)
    // after render restore scroll
    this.active.renderPromise.then(() => {
        if (scrollOffsets[location.hash]) {
            window.scrollTo(0, scrollOffsets[location.hash])
        }
    })
}

function renderVideo () {
    // create video tag
    this.browserElm.innerHTML = `<video id="ciph-video" controls></video>`
    // create video player
    this.active = new CiphVideoPlayer('ciph-video', this.activeLink, this)
}

function setTitle (title, onPage) {
    // add title to page
    if (onPage !== false) {
        const titleElm = document.createElement('h1')
        titleElm.appendChild(document.createTextNode(title))
        this.browserElm.insertBefore(titleElm, this.browserElm.childNodes[0])
    }

    document.title = title
}

/* private methods */

function assert (isTrue, msg) {
    if (!isTrue) {
        alert(msg)
        throw new Error(msg)
    }
}

function bufferFromHex (hex) {
    const length = hex.length
    assert(length % 2 === 0, 'invalid hex string')
    const buffer = new ArrayBuffer(length / 2)
    const arr = new Uint8Array(buffer)
    for (let i = 0; i < length; i += 2) {
        arr[i / 2] = parseInt(hex.substr(i, 2), 16)
    }
    return buffer
}

function bufferToHex (buffer) {
    const arr = new Uint8Array(buffer)
    let hex = ''
    for (let i = 0; i < arr.length; ++i) {
        let value = arr[i].toString(16)
        if (value.length === 1) value = '0' + value
        hex += value
    }
    return hex
}

function popStateHandler () {
    ciphBrowser.render(location.hash)
}

})()