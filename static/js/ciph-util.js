(function () {

/* window globals */

window.assert = function assert (isTrue, msg) {
    if (!isTrue) {
        alert(msg)
        throw new Error(msg)
    }
}

window.defined = function defined (val) {
    return val !== undefined
}

window.ce = document.createElement.bind(document)
window.el = document.getElementById.bind(document)

/* local globals */

const MD = markdownit().disable(['image'])
const MDImages = markdownit()

const KB = 1024
const MB = 1024*KB

const blockSizes = [ 4*KB, 16*KB, 64*KB, 256*KB, 1*MB, 4*MB, 16*MB ]
const ciphLinkRegExp = /^ciph:\/\//
const ciphLinksRegExp = /\b(https|ciph):\/\/.*?\d-\d-[a-f0-9]{32}-[a-f0-9]{32}-[a-f0-9]{32}[^\s]*/g
const ciphLinkExtractRegExp = /^.*?(\d-\d-[a-f0-9]{32}-[a-f0-9]{32}-[a-f0-9]{32}.*)/
const contentTypeNames = ['Collection', 'Page', 'Video', 'Audio', 'Image']
const contentTypes = ['collection', 'page', 'video', 'audio', 'image']
const hash32RegExp = /^[0-9a-f]{32}$/
const httpCiphLinkRegExp = /#\d-\d-[a-f0-9]{32}-[a-f0-9]{32}-[a-f0-9]{32}/

const linkClickHandlers = {
    chat: function (ev) { window.ciphBrowser.open(ev.target.href, ev, 'chat') },
    page: function (ev) { window.ciphBrowser.open(ev.target.href, ev, 'page') },
}

const defaultMimeType = 'application/octet-stream'
const mimeTypes = {
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
}

window.CiphUtil = class CiphUtil {

    static bufferConcat (buffers) {
        let totalLength = 0
        // get length of all buffers
        for (const buffer of buffers) {
            totalLength += buffer.byteLength
        }
        // create new buffer with combined length
        const buffer = new ArrayBuffer(totalLength)
        // offset if destination buffer when copying
        let offset = 0
        // copy data to new buffer
        for (const source of buffers) {
            CiphUtil.bufferCopy(source, buffer, source.byteLength, 0, offset)
            offset += source.byteLength
        }

        return buffer
    }

    static bufferCopy (srcBuffer, dstBuffer, bytes=0, srcOffset=0, dstOffset=0) {
        const dstArr = new Uint8Array(dstBuffer)
        const srcArr = new Uint8Array(srcBuffer)

        for (let i=0; i<bytes; i++) {
            dstArr[dstOffset+i] = srcArr[srcOffset+i]
        }
    }

    static bufferFromHex (hex) {
        const length = hex.length
        assert(length % 2 === 0, 'invalid hex string')
        const buffer = new ArrayBuffer(length / 2)
        const arr = new Uint8Array(buffer)
        for (let i = 0; i < length; i += 2) {
            arr[i / 2] = parseInt(hex.substr(i, 2), 16)
        }
        return buffer
    }

    static bufferToBase64 (buffer) {
        let binary = ''
        const arr = new Uint8Array(buffer)
        for (const byte of arr) {
            binary += String.fromCharCode(byte)
        }
        return btoa(binary)
    }

    static bufferToHex (buffer) {
        const arr = new Uint8Array(buffer)
        let hex = ''
        for (let i = 0; i < arr.length; ++i) {
            let value = arr[i].toString(16)
            if (value.length === 1) value = '0' + value
            hex += value
        }
        return hex
    }

    static bufferFromString (str) {
        return new TextEncoder().encode(str)
    }

    static buffersEqual (bufA, bufB) {
        if (bufA.byteLength !== bufB.byteLength) return false
        const arrA = new Uint8Array(bufA)
        const arrB = new Uint8Array(bufB)
        const length = arrA.length

        for (let i=0; i < length; i++) {
            if (arrA[i] !== arrB[i]) return false
        }

        return true
    }

    static bufferToString (buffer) {
        return new TextDecoder().decode(buffer)
    }

    static async deriveKey (password, salt) {
        // get key from password
        const key = await crypto.subtle.importKey(
            'raw',
            password,
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        )
        // get derived key
        const derivedKey = await crypto.subtle.deriveKey(
            {
                hash: { name: 'SHA-256' },
                iterations: 10000,
                name: 'PBKDF2',
                salt: salt,
            },
            key,
            {
                length: 256,
                name: 'AES-CTR',
            },
            true,
            ['encrypt', 'decrypt']
        )

        return derivedKey
    }

    static randomItem (arr) {
        if (!Array.isArray(arr)) {
            throw new Error('array required')
        }

        return arr[Math.floor(Math.random() * arr.length)]
    }

    static domFromMarkdown (markdown, source, pre = '<div>', post = '</div>', images) {
        // require valid source
        assert(defined(linkClickHandlers[source]), `invalid source ${source}`)
        // it data is a single link and does not contain link formatting then
        // replace bare links in text
        if (!markdown.match(/\n/) && !markdown.match(/[\[\]\(\)]/)) {
            // locate any ciph links in text without markdown link formating
            const ciphLinks = markdown.match(ciphLinksRegExp)
            if (ciphLinks) {
                for (const ciphLink of ciphLinks) {
                    const [, link] = ciphLink.match(ciphLinkExtractRegExp)
                    const contentType = link.substr(2, 1)
                    if (!contentTypeNames[contentType]) {
                        continue
                    }
                    markdown = markdown.replace(ciphLink, `[Ciph ${contentTypeNames[contentType]} Link](ciph://${link})`)
                }
            }
        }
        // render markdown to html
        const html = images ? MDImages.render(markdown) : MD.render(markdown)
        // create new dom fragment from markdown rendered as html
        const dom = new DOMParser().parseFromString(
            pre + html + post,
            'text/html'
        )
        const links = CiphUtil.getElements(dom, 'a')
        // remove outbound links and open ciph links with JS
        for (let i=0; i < links.length; i++) {
            const link = links[i]
            if (link.href.match(ciphLinkRegExp) || link.href.match(httpCiphLinkRegExp)) {
                link.addEventListener('click', linkClickHandlers[source])
            }
            else {
                // create new element to replace link
                const span = document.createElement('span')
                span.textContent = `${link.textContent} (${link.href})`
                // replace link with span text
                link.parentNode.replaceChild(span, link)
            }
        }
        // return container div
        return dom.getElementsByTagName('div')[0]
    }

    static getElements (dom, tagName) {
        const collection = dom.getElementsByTagName(tagName)
        const elements = []
        // copy elements from live collection to array
        for (let i=0; i < collection.length; i++) {
            elements.push(collection[i])
        }

        return elements
    }

    static getMimeType (fileName) {
        const matches = fileName.match(/\.(\w+)$/)
        if (!matches) {
            return defaultMimeType
        }

        const ext = matches[1].toLowerCase()

        return mimeTypes[ext] || defaultMimeType
    }

    static loadMedia (dom, viewer) {
        // get all image tags - these may be images or other types of media
        const elements = CiphUtil.getElements(dom, 'img')

        for (const element of elements) {
            // get src of image
            const src = element.getAttribute('src')
            // if link is to ciph content then load if valid
            if (src.match(ciphLinksRegExp)) {
                try {
                    const link = CiphUtil.parseLink(src)
                    // currently only video supported
                    if (link.contentType !== 2) {
                        console.log(`invalid content type for media src ${src}`)
                        continue
                    }
                    // get number of video within collection
                    const videoNum = viewer.videos.length
                    // create unique id for video elm
                    const videoElmId = `ciph-video-${videoNum}`
                    // create new video element that will replace img
                    const videoElm = ce('video')
                    videoElm.id = videoElmId
                    videoElm.setAttribute('controls', true)
                    // replace img element with video
                    element.parentNode.replaceChild(videoElm, element)
                    // args for new video player
                    const playerArgs = {
                        browser: viewer.browser,
                        link: src,
                        videoElm: videoElm,
                        videoElmId: videoElmId,
                    }
                    // only allow resume/autoplay on first video
                    if (videoNum > 0) {
                        playerArgs.autoplay = false
                        playerArgs.resume = false
                    }
                    // create new video player
                    const player = new CiphVideoPlayer(playerArgs)
                    // add video to list in viewer
                    viewer.videos.push(player)
                }
                catch (err) {
                    console.error(err)
                }
            }
            // any other link must be plain file
            else if (src.includes('/')) {
                console.error(`invalid media src ${src}`)
            }
            // otherwise should be file in container
            else {
                // set empty image till loaded
                element.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==')
                // image file must be in container
                viewer.client.getFileDataURI(src).then(dataURI => {
                    element.setAttribute('src', dataURI)
                })
            }
        }
    }

    static parseLink (url) {
        // remove any protocol from url
        url = url.replace(/^\w+:\/\/([^#]+#)?/, '')
        // split url into parts
        const [blockSize, contentType, blockId0, blockId1, salt, password] = url.split('-')
        // validate url
        assert(defined(blockSizes[blockSize]), 'invalid block size')
        assert(defined(contentTypes[contentType]), 'invalid content type')
        assert(blockId0.match(hash32RegExp), 'invalid block id 0')
        assert(blockId1.match(hash32RegExp), 'invalid block id 1')
        assert(salt.match(hash32RegExp), 'invalid salt')
        // set link
        const link = {
            blockSize: parseInt(blockSize),
            contentType: parseInt(contentType),
            blockId0,
            blockId1,
            salt,
            password,
        }
        // set true if password in url
        link.passwordInUrl = defined(link.password)

        return link
    }

    static async sha256 (data, encoding, length) {
        if (encoding) {
            assert(encoding === 'hex', 'invalid encoding')
        }

        const digest = await crypto.subtle.digest({ name: 'SHA-256' }, data)

        if (length) {
            if (encoding === 'hex') {
                return CiphUtil.bufferToHex(digest).substr(0, length)
            }
            else {
                return new DataView(digest, 0, length)
            }
        }
        else {
            if (encoding === 'hex') {
                return CiphUtil.bufferToHex(digest)
            }
            else {
                return digest
            }
        }
    }

    static xorBuffer (a, b) {
        assert(a.byteLength === b.byteLength, 'ArrayBuffer lengths must match')
        const length = a.byteLength
        const xor = new ArrayBuffer(length)

        const aView = new Int32Array(a)
        const bView = new Int32Array(b)
        const xorView = new Int32Array(xor)

        const viewLength = length / 4

        for (let i=0; i < viewLength; i++) {
            xorView[i] = aView[i] ^ bView[i]
        }

        return xor
    }
}

})()
