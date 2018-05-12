(function () {

'use strict'

/* exports */
window.CiphCollectionViewer = class CiphCollectionViewer {

    constructor (args = {}) {
        assert(window.markdownit, 'markdownit not loaded')
        // get element to render to
        this.pageElmId = args.pageElmId || 'ciph-page'
        this.pageElm = document.getElementById(this.pageElmId)
        assert(this.pageElm, 'invalid pageElm')
        // set to true if render is canceled before load
        this.canceled = false
        // create client instance to fetch data
        this.client = new CiphContainerClient(args.link)
        // markdown index file loaded with container
        this.markdown = ''
        // wait for head to load
        this.renderPromise = this.client.head.promise.then(async () => {
            // do not continue if canceled
            if (this.canceled) {
                return
            }
            this.markdown = await this.client.getFile(this.client.meta.index)
            if (typeof this.markdown !== 'string') {
                this.markdown = CiphUtil.bufferToString(this.markdown)
            }
            this.render()
        }).catch(console.error)
        // list of embedded videos
        this.videos = []
    }

    cancel () {
        this.canceled = true
    }

    render () {
        // render dom from markdown
        const dom = CiphUtil.domFromMarkdown(this.markdown, 'page', `<div id="${this.pageElmId}">`, '</div>', true)
        // load media referenced in dom
        CiphUtil.loadMedia(dom, this)
        // replace existing page
        this.pageElm.parentNode.replaceChild(dom, this.pageElm)
        // update reference to element
        this.pageElm = dom
    }

}

})()