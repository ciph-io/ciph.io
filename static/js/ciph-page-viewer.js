(function () {

'use strict'

window.CiphPageViewer = CiphPageViewer

function CiphPageViewer (pageElmId, link) {
    this.canceled = false
    this.client = new CiphContainerClient(link)
    this.pageElmId = pageElmId
    this.pageElm = document.getElementById(this.pageElmId)

    assert(window.markdownit, 'markdownit not loaded')
    assert(this.pageElm, 'invalid pageElm')

    // wait for head to load
    this.client.head.promise.then(() => {
        // do not continue if canceled
        if (this.canceled) return
        // get page markdown
        this.markdown = this.client.getPage()
        // render page html to element
        this.render()
    })
}

CiphPageViewer.prototype = {
    cancel,
    render,
}

function cancel () {
    this.canceled = true
}

function render () {
    const md = markdownit().disable(['image'])

    this.pageElm.innerHTML = md.render(this.markdown)
    // get all links from page
    const links = this.pageElm.getElementsByTagName('a')
    // remove outbound links and open ciph links with JS
    for (const link of links) {
        if (link.href.match(/^ciph:\/\//)) {
            link.addEventListener('click', linkClickHandler)
        }
        else {
            // create new element to replace link
            const span = document.createElement('span')
            span.textContent = `${link.textContent} (${link.href})`
            // replace link with span text
            link.parentNode.replaceChild(span, link)
        }
    }

}

/* private methods */

function assert (isTrue, msg) {
    if (!isTrue) {
        alert(msg)
        throw new Error(msg)
    }
}

function linkClickHandler (ev) {
    ev.preventDefault()

    ciphBrowser.open(ev.target.href)
}

})()