(function () {

'use strict'

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
        }).catch(console.error)
    }

    cancel () {
        this.canceled = true
    }

    render () {
        // render dom from markdown
        const dom = CiphUtil.domFromMarkdown(this.markdown, 'page')
        // set id on dom to match page elm
        dom.id = this.pageElmId
        // replace existing page
        this.pageElm.parentNode.replaceChild(dom, this.pageElm)
        // update reference to element
        this.pageElm = dom
    }

}

})()