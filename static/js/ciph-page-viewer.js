(function () {

'use strict'

const ciphLinkRegExp = /^ciph:\/\//
const httpCiphLinkRegExp = /#\d-\d-[a-f0-9]{32}-[a-f0-9]{32}-[a-f0-9]{32}/

/* exports */
window.CiphPageViewer = class CiphPageViewer {

    constructor (pageElmId, link) {
        this.canceled = false
        this.client = new CiphContainerClient(link)
        this.pageElmId = pageElmId
        this.pageElm = document.getElementById(this.pageElmId)

        assert(window.markdownit, 'markdownit not loaded')
        assert(this.pageElm, 'invalid pageElm')

        // wait for head to load
        this.renderPromise = this.client.head.promise.then(() => {
            // do not continue if canceled
            if (this.canceled) return
            // get page markdown
            this.markdown = this.client.getPage()
            // render page html to element
            this.render()
        })
    }

    cancel () {
        this.canceled = true
    }

    render () {
        const md = markdownit().disable(['image'])

        const doc = new DOMParser().parseFromString(md.render(this.markdown), 'text/html')
        // get all links from page - copy to array so collection doesn't change
        // when dom modified
        const col = doc.getElementsByTagName('a')
        const links = []
        for (let i=0; i < col.length; i++) links.push(col[i])
        // remove outbound links and open ciph links with JS
        for (let i=0; i < links.length; i++) {
            const link = links[i]
            if (link.href.match(ciphLinkRegExp) || link.href.match(httpCiphLinkRegExp)) {
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

        // empty
        this.pageElm.innerHTML = ''
        // set content
        this.pageElm.appendChild(doc.getElementsByTagName('body')[0])
    }

}

/* private methods */

function linkClickHandler (ev) {
    ev.preventDefault()
    ciphBrowser.open(ev.target.href)
}

})()