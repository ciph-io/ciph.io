(function () {

'use strict'

/* globals */

const KB = 1024
const MB = 1024*KB

const hash32RegExp = /^[0-9a-f]{32}$/
const hash64RegExp = /^[0-9a-f]{64}$/
const blockSizes = [ 4*KB, 16*KB, 64*KB, 256*KB, 1*MB, 4*MB, 16*MB ]
const contentTypes = ['collection', 'page', 'video', 'audio', 'image']

const testBlockPath = '/get-proxy/0/5ff536a6d8d90bd3a561cd8440810b90.ciph'

let proxyHost = ''

const proxyHosts = [
    {
        hosts: [
            'https://proxy-de-1.ciph.io',
            'https://proxy-de-2.ciph.io',
            'https://proxy-de-3.ciph.io',
            'https://proxy-de-4.ciph.io',
        ],
        region: 'de',
        time: 0,
    },
    {
        hosts: [
            'https://proxy-usc-1.ciph.io',
        ],
        region: 'usc',
        time: 0,
    },
    {
        hosts: [
            'https://proxy-usw-1.ciph.io',
        ],
        region: 'usw',
        time: 0,
    },
]

setProxyHost()

/* exports */
window.CiphContainerClient = class CiphContainerClient {

    constructor (url, options) {
        const link = this.getLinkFromUrl(url)
        // encryption key for chat messages
        this.chatKeyBuffer = null
        // list of data blocks
        this.dataBlocks = []
        // data included in head block if any
        this.dataBuffer = null
        // 32 byte hex hash id of head block ids and derived key
        this.id = ''
        // meta data
        this.meta = null
        // list of meta blocks if any
        this.metaBlocks = []
        // head block 
        this.head = {
            data: null,
            promise: this.loadHead(link),
        }
    }

    /**
     * @function decodeHead
     *
     * extract binary encoded head data
     *
     * @param {ArrayBuffer} data
     * @param {ArrayBuffer} block
     *
     * @returns {Promise<object>}
     */
    async decodeHead (data, block) {
        let offset = 0
        // create data view
        const dataView = new DataView(data)
        // chat key is first 32 bytes
        this.chatKeyBuffer = data.slice(offset, 32)
        offset += 32
        // meta data length uint32 (4 bytes)
        const metaLength = dataView.getUint32(offset)
        offset += 4
        // number of meta blocks uint16 (2 bytes)
        const numMetaBlocks = dataView.getUint16(offset)
        offset += 2
        // get meta data
        const metaData = data.slice(offset, offset+metaLength)
        offset += metaLength
        // data length float64 (8 bytes)
        const dataLength = dataView.getFloat64(offset)
        offset += 8
        // number of data blocks uint32 (4 bytes)
        const numDataBlocks = dataView.getUint32(offset)
        offset += 4
        // if there are no data blocks then data is in head
        if (numDataBlocks === 0) {
            this.dataBuffer = data.slice(offset, offset+dataLength)
            offset += dataLength
        }
        // get info for each data block
        for (let i=0; i < numDataBlocks; i++) {
            // block size uint8 (1 byte)
            const blockSize = dataView.getInt8(offset)
            offset += 1
            // block id 0 raw (16 bytes)
            const blockId0 = data.slice(offset, offset+16)
            offset += 16
            // block id 1 raw (16 bytes)
            const blockId1 = data.slice(offset, offset+16)
            offset += 16
            // key
            const key = data.slice(offset, offset+32)
            offset += 32
            // add to list of blocks
            this.dataBlocks.push({
                ids: [
                    CiphUtil.bufferToHex(blockId0),
                    CiphUtil.bufferToHex(blockId1),
                ],
                key: await crypto.subtle.importKey(
                    'raw',
                    key,
                    {
                        length: 256,
                        name: 'AES-CTR',
                    },
                    true,
                    ['encrypt', 'decrypt']
                ),
                size: blockSize,
            })
        }
        // SHA-256 digest of head data
        const headDigest = data.slice(offset, offset+32)
        // create view of block
        const blockView = new Uint8Array(block)
        // create array view of decrypted data
        const dataViewUint8 = new Uint8Array(data)
        // copy decrypted head data over encrypted block data so that
        // both can be hashed together to verify digest
        for (let i = 0; i < offset; i++) {
            blockView[i+2] = dataViewUint8[i]
        }
        // create view of block with only the plain prefix and unencrypted data
        const decryptedBlockView = new DataView(block, 0, offset+2)
        // calculate digest to verify
        const digest = await crypto.subtle.digest({ name: 'SHA-256' }, decryptedBlockView)
        assert(CiphUtil.buffersEqual(headDigest, digest), 'head digest verification failed')
        // if there are no meta blocks then meta is included in head
        if (numMetaBlocks === 0) {
            // decompress meta data
            const metaUnzipped = pako.ungzip(metaData, { to: 'string' })
            // parse data
            this.meta = JSON.parse(metaUnzipped)
        }
        else {
            throw new Error('meta blocks not yet supported')
        }
    }

    /**
     * @function decryptBlock
     *
     * decrypt block using raw key
     *
     * @param {ArrayBuffer} block
     * @param {CryptoKey} key
     *
     * @returns {Promise<ArrayBuffer>}
     */
    async decryptBlock (block, key) {
        // get raw key
        const rawKey = await crypto.subtle.exportKey('raw', key)
        // get hash of raw key to use as iv for decrypt
        const digest = await crypto.subtle.digest({ name: 'SHA-256' }, rawKey)
        // use first 16 bytes of digest for iv
        const counter = digest.slice(0, 16)
        // decrypt block
        const plain = await window.crypto.subtle.decrypt(
            {
                name: 'AES-CTR',
                counter: counter,
                length: 128,
            },
            key,
            block
        )

        return plain
    }

    /**
     * @function get
     *
     * do fetch
     *
     * @returns Promise<object>
     */
    async get (url, options = {}) {
        if (!defined(options.credentials))
            options.credentials = 'omit'

        const res = await fetch(url, options)

        if (res.ok) return res

        let message = res.statusText
        // try to get error from response
        if (res.status === 400) {
            try {
                const json = await res.json()
                if (json.error) {
                    message = json.error
                }
            }
            catch (err) {}
        }

        throw new Error(message)
    }

    /**
     * @function findFile
     *
     * search for file by string name or regular expression
     *
     * @param {string|RegExp} match
     *
     * @returns {object}
     */
    findFile (match) {
        // if meta does not contain files array then not found
        if (!Array.isArray(this.meta.files)) {
            return null
        }

        const found = this.findFiles(match)

        return found.length > 0 ? found[0] : null
    }

    /**
     * @function findFiles
     *
     * search for file(s) by string name or regular expression
     *
     * @param {string|RegExp} match
     *
     * @returns {array}
     */
    findFiles (match) {
        // if meta does not contain files array then not found
        if (!Array.isArray(this.meta.files)) {
            return []
        }

        const files = this.meta.files
        const length = files.length

        const found = []

        if (typeof match === 'string') {
            for (let i=0; i < length; i++) {
                if (files[i].name === match) found.push(files[i])
            }
        }
        else {
            for (let i=0; i < length; i++) {
                if (files[i].name.match(match)) found.push(files[i])
            }
        }

        return found
    }

    /**
     * @function getBlock
     *
     * load two ciph blocks and return XOR
     *
     * @param {integer|string} blockSize
     * @param {string} blockId0
     * @param {string} blockId1
     *
     * @returns {Promise<ArrayBuffer>}
     */
    async getBlock (blockSize, blockId0, blockId1) {
        const [data0, data1] = await Promise.all([
            this.getSubBlock(blockSize, blockId0),
            this.getSubBlock(blockSize, blockId1),
        ])

        return CiphUtil.xorBuffer(data0, data1)
    }

    /**
     * @function getBlocksForFile
     *
     * get list of block(s) that contain file.
     *
     * @param {object} file
     *
     * @returns {Array}
     */
    getBlocksForFile (file) {
        // list of blocks containing file
        const blocks = []
        // bytes needed for complete file
        let bytesRemaining = file.length
        // starting with first get all blocks needed for file
        for (let i=file.block; i < this.dataBlocks.length; i++) {
            // get block
            const block = this.dataBlocks[i]
            // if this is the first block then get offset from file
            const offset = blocks.length === 0 ? file.offset : 0
            // add current block to blocks
            blocks.push(block)
            // subtract bytes of file included in block
            bytesRemaining -= (blockSizes[block.size] - offset)
            // return blocks if no bytes left
            if (bytesRemaining <= 0) {
                return blocks
            }
        }

        throw new Error('invalid blocks')
    }

    /**
     * @function getFile
     *
     * find file by name. fetch and decode data blocks. return file.
     *
     * @param {string} fileName
     *
     * @returns {Promise<ArrayBuffer>}
     */
    async getFile (fileName) {
        fileName = decodeURI(fileName)
        // get file data
        const file = this.findFile(fileName)
        assert(file, 'file not found')
        // get block(s) that contain file
        const dataBlocks = this.getBlocksForFile(file)
        // promises to be resolved with retrieved blocks
        const blocks = await Promise.all(dataBlocks.map(async dataBlock => {
            // fetch and xor blocks
            const block = await this.getBlock(dataBlock.size, dataBlock.ids[0], dataBlock.ids[1])
            // decrypt block
            return this.decryptBlock(block, dataBlock.key)
        }))
        // create new buffer for file data
        const buffer = new ArrayBuffer(file.length)
        let bytesRemaining = file.length
        let dstOffset = 0
        // copy data to buffer
        for (let i=0; i < dataBlocks.length; i++) {
            const dataBlock = dataBlocks[i]
            const srcBuffer = blocks[i]
            const srcOffset = i === 0 ? file.offset : 0
            const copyBytes = bytesRemaining > blockSizes[dataBlock.size] - srcOffset
                ? blockSizes[dataBlock.size] - srcOffset
                : bytesRemaining
            CiphUtil.bufferCopy(srcBuffer, buffer, copyBytes, srcOffset, dstOffset)
            bytesRemaining -= copyBytes
            dstOffset += copyBytes
        }
        // get digest of file to validate
        const digest = await crypto.subtle.digest({ name: 'SHA-256' }, buffer)
        assert(CiphUtil.bufferToHex(digest) === file.digest, 'invalid file')

        return buffer
    }

    /**
     * @function getLinkFromUrl
     *
     * validate url and extract link from it
     *
     * @param {string} url
     *
     * @returns {object}
     */
    getLinkFromUrl (url) {
        // remove any protocol from url
        url = url.replace(/^\w+:\/\/(.*?\/enter\?ciph=)?/, '')
        // split url into parts
        const [blockSize, contentType, blockId0, blockId1, salt, password] = url.split('-')
        // validate url
        assert(defined(blockSizes[blockSize]), 'invalid block size')
        assert(defined(contentTypes[contentType]), 'invalid content type')
        assert(blockId0.match(hash32RegExp), 'invalid block id 0')
        assert(blockId1.match(hash32RegExp), 'invalid block id 1')
        assert(salt.match(hash32RegExp), 'invalid salt')

        return {
            blockSize: parseInt(blockSize),
            contentType: parseInt(contentType),
            blockId0,
            blockId1,
            salt,
            password,
        }
    }

    /**
     * @function getPage
     *
     * get unzipped page text
     *
     * @returns {string}
     */
    getPage () {
        assert(this.meta.type === 'page', 'invalid content type')
        assert(this.dataBuffer, 'dataBuffer is null')
        // decompress page data
        return pako.ungzip(this.dataBuffer, { to: 'string' })
    }

    /**
     * @function getSubBlock
     *
     * load single ciph block. validate. TODO: retry on error.
     *
     * @param {integer|string} blockSize
     * @param {string} blockId
     * @param {integer|undefined} retry
     *
     * @returns {Promise<ArrayBuffer>}
     */
    async getSubBlock (blockSize, blockId, retry) {
        try {
            const res = await this.get(`${proxyHost}/get-proxy/${blockSize}/${blockId}.ciph`)
            const data = await res.arrayBuffer()

            return data
        }
        catch (err) {
            console.error(err)
            // TODO: retry
            throw err
        }
    }

    /**
     * @function loadHead
     *
     * load head block
     * prompt for password if not in url
     *
     * @param {object} link
     *
     * @returns {Promise}
     */
    async loadHead (link) {
        let block
        // download and xor blocks
        try {
            block = await this.getBlock(link.blockSize, link.blockId0, link.blockId1)
        }
        catch (err) {
            const message = defined(err) ? err.message : 'unknown'
            alert(`Error: ${message}`)
            throw err
        }
        // get data view for block
        const blockView = new DataView(block)
        // get version from block
        this.head.version = blockView.getInt8(0)
        assert(this.head.version === 1, 'invalid version')
        // get content type from block
        this.head.contentType = blockView.getInt8(1)
        assert(this.head.contentType === link.contentType, 'content type mismatch')
        // first two bytes are plain, rest of head block is encrypted
        const encryptedBlock = new DataView(block, 2)
        // retry decrypting head until password correct or canceled
        while (true) {
            if (typeof link.password !== 'string' || link.password.length === 0) {
                link.password = prompt('Please enter password')
                // if promp was canceled exit loop
                if (link.password === null) {
                    return
                }
            }
            try {
                // derive key from password and salt
                const key = await CiphUtil.deriveKey(
                    CiphUtil.bufferFromString(link.password),
                    CiphUtil.bufferFromHex(link.salt)
                )
                // decrypt head block
                const data = await this.decryptBlock(encryptedBlock, key)
                // extract binary encoded head data
                const head = await this.decodeHead(data, block)
                // exit retry when head loaded
                return
            }
            catch (err) {
                console.error(err)
                alert(err.message)
                link.password = ''
            }
        }
    }

    /**
     * @function validate
     *
     * fetch all files to validate
     *
     */
    async validate () {
        for (const file of this.meta.files) {
            await this.getFile(file.name)
        }
    }

}

/* private methods */

/**
 * @function setProxyHost
 *
 * set proxy host, first using default, then setting host based on respose
 * time from tests hosts in each region
 *
 */
function setProxyHost () {
    let dev = false
    // if in dev use dev proxy host
    if (location.host === 'dev.ciph.io') {
        proxyHost = 'https://dev.ciph.io'
        dev = true
    }
    // otherwise default to random tier 1 proxy
    else {
        proxyHost = CiphUtil.randomItem(proxyHosts[0].hosts)
    }

    const start = Date.now()

    let set = false

    for (const proxyHostRegion of proxyHosts) {
        const newProxyHost = CiphUtil.randomItem(proxyHostRegion.hosts)
        fetch(`${newProxyHost}${testBlockPath}`, {
            cache: 'no-store'
        }).then(res => {
            proxyHostRegion.time = Date.now() - start
            if (!dev && !set) {
                console.log(`set proxy host: ${newProxyHost}`)
                proxyHost = newProxyHost
                set = true
            }
        }).catch(console.error)
    }
}

})();