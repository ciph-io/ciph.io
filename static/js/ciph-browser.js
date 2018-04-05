(function () {

'use strict'

/* exports */
window.CiphBrowser = CiphBrowser

/* globals */
const contentTypes = ['collection', 'page', 'video', 'audio', 'image']

const linkRegExp = /^\d-\d-[a-f0-9]{32}-[a-f0-9]{32}-[a-f0-9]{32}/

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
    const url = new URL(location.href)
    this.render( url.searchParams.get('ciph') )
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
    // remove any protocol from url
    link = link.replace(/^\w+:\/\/(.*?\/enter\?ciph=)?/, '')
    // change url
    history.pushState({}, '', `/enter?ciph=${link}`)
    // render
    this.render(link)
}

function render (link) {
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
}

function renderVideo () {
    // create video tag
    this.browserElm.innerHTML = `<video id="ciph-video" controls autoplay></video>`
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

function popStateHandler () {
    // get ciph link from url
    const url = new URL(location.href)
    ciphBrowser.render( url.searchParams.get('ciph') )
}

})()