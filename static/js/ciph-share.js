(function () {

'use strict'

const tagImageDataURL = 'data:image/png;base64,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'

/* exports */
window.CiphShare = class CiphShare {

    constructor (args = {}) {
        // initialize chat element where html will be rendered
        this.elmId = args.elmId || 'ciph-share'
        this.elm = document.getElementById(this.elmId)
        assert(this.elm, 'invalid elmId')
        // set to true when qrcode show
        this.qrcodeVisible = false
        // create image from data uri
        this.tagImage = new Image
        this.tagImage.src = tagImageDataURL
    }

    hideQRCode () {
        el('share-qrcode').classList.add('hide')
        this.qrcodeVisible = false
    }

    createQRCodeImage () {
        return new Promise((resolve) => {
            const qr = qrcodeCreator(12, 'M')
            const href = location.href.substr(0, 287)
            qr.addData(href)
            qr.make()

            const qrcodeImage = new Image

            qrcodeImage.onload = () => {
                resolve(qrcodeImage)
            }

            qrcodeImage.src = qr.createDataURL(3)
        })
    }

    async loadImage () {
        const imageInput = el('share-qrcode-image')
        if (!imageInput.files.length) {
            return
        }

        return new Promise (resolve => {
            // create file reader to load file
            const fileReader = new FileReader()
            // convert to image once loaded
            fileReader.onload = ev => {
                const image = new Image
                image.onload = () => {
                    resolve(image)
                }
                image.src = ev.target.result
            }
            // load image file as data url
            fileReader.readAsDataURL(imageInput.files[0])
        })
    }

    async renderQRCode (args = {}) {
        const canvas = el('share-qrcode-canvas')
        canvas.setAttribute('height', '240')
        canvas.setAttribute('width', '220')
        // set to true to save as jpeg
        let saveJpeg = false
        // get cavas context
        const ctx = canvas.getContext('2d')
        // set offsets for qrcode - will be changed if image loaded
        let qrcodeOffsetTop = 0
        let qrcodeOffsetLeft = 0
        // pull base image from video
        if (args.fromVideo) {
            const video = el('ciph-video')
            if (video) {
                // always save video as jpeg
                saveJpeg = true
                // real height and width of video
                let height = video.videoHeight
                let width = video.videoWidth
                // set max width of 1000
                if (width > 1000) {
                    height = height * (1000 / width)
                    width = 1000
                }
                // set min width of 64
                if (width < 640) {
                    height = height * (640 / width)
                    width = 640
                }
                // resize canvas to fit image
                if (height > 240) {
                    qrcodeOffsetTop = height - 240
                    canvas.setAttribute('height', height)
                }
                if (width > 220) {
                    qrcodeOffsetLeft = width - 220
                    canvas.setAttribute('width', width)
                }
                // draw image
                ctx.drawImage(video, 0, 0, width, height)
            }
        }
        // pull base image from file
        else {
            // load image from file input if any
            const baseImage = await this.loadImage()
            if (baseImage) {
                // if input file is jpeg also save as jpeg
                if (baseImage.src.match(/^data:image\/jpeg/)) {
                    saveJpeg = true
                }
                let height = baseImage.height
                let width = baseImage.width
                // set max width of a 1000
                if (width > 1000) {
                    height = height * (1000 / width)
                    width = 1000
                }
                // resize canvas to fit image
                if (height > 240) {
                    qrcodeOffsetTop = height - 240
                    canvas.setAttribute('height', height)
                }
                if (width > 220) {
                    qrcodeOffsetLeft = width - 220
                    canvas.setAttribute('width', width)
                }
                // draw image
                ctx.drawImage(baseImage, 0, 0, width, height)
            }
        }
        // draw white background for qrcode
        ctx.fillStyle = 'white'
        ctx.fillRect(qrcodeOffsetLeft, qrcodeOffsetTop, 220, 240)
        // draw qrcode
        ctx.drawImage(await this.createQRCodeImage(), qrcodeOffsetLeft, qrcodeOffsetTop)
        // draw ciph.io tag
        ctx.drawImage(this.tagImage, qrcodeOffsetLeft, qrcodeOffsetTop+210)

        // render as jpg if base image is jpg
        if (saveJpeg) {
            el('share-qrcode-final-image').src = canvas.toDataURL('image/jpeg', 0.7)
        }
        else {
            el('share-qrcode-final-image').src = canvas.toDataURL('image/png')
        }
    }

    async shareQRCode () {
        // hide on second click
        if (this.qrcodeVisible) {
            this.hideQRCode()
            return
        }
        // render qrcode
        await this.renderQRCode()
        // show div
        this.showQRCode()
    }

    showQRCode () {
        // get video element if any
        const video = el('ciph-video')
        if (video) {

        }
        // show
        el('share-qrcode').classList.remove('hide')
        this.qrcodeVisible = true
    }

}

})()