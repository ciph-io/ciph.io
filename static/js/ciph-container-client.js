(function () {

'use strict'

/* globals */

const KB = 1024
const MB = 1024*KB

const secureLinkRegExp = /^\d-\d(-[0-9a-f]{32}){3}$/

const blockRequests = {}

const blockSizes = [ 4*KB, 16*KB, 64*KB, 256*KB, 1*MB, 4*MB, 16*MB ]

const proxyServers = [
    ['proxy-de-10', 'proxy-de-12'],
    ['proxy-de-11', 'proxy-de-13'],
]

/* exports */
window.CiphContainerClient = class CiphContainerClient {

    constructor (url, options = {}) {
        // validate and extract url components
        this.link = CiphUtil.parseLink(url)
        // encryption key for chat messages
        this.chatKeyBuffer = null
        // list of data blocks
        this.dataBlocks = []
        // data included in head block if any
        this.dataBuffer = null
        // raw encrypted head data block
        this.headBlock = null
        // key object used for crypto operations
        this.key = null
        // raw key buffer
        this.keyBuffer = null
        // 32 byte hex hash id of head block ids and key
        this.privateId = ''
        // 32 byte hex hash id of head block ids
        this.publicId = ''
        // meta data
        this.meta = null
        // list of meta blocks if any
        this.metaBlocks = []
        // ciph user
        this.partner = options.partner || window.ciphPartner
        this.user = options.user || window.ciphUser
        // head block
        this.head = {
            data: null,
            promise: this.loadHead(),
        }
    }

    /**
     * @function decodeHead
     *
     * extract binary encoded head data
     *
     * @param {ArrayBuffer} data
     *
     * @returns {Promise<object>}
     */
    async decodeHead (data) {
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
        // create view of raw head block
        const blockView = new Uint8Array(this.headBlock)
        // create view of decrypted head data
        const dataViewUint8 = new Uint8Array(data)
        // copy decrypted head data over encrypted block data so that
        // both can be hashed together to verify digest
        for (let i = 0; i < offset; i++) {
            blockView[i+2] = dataViewUint8[i]
        }
        // create view of head block with only the plain prefix and unencrypted data
        const decryptedBlockView = new DataView(this.headBlock, 0, offset+2)
        // calculate digest to verify
        const digest = await CiphUtil.sha256(decryptedBlockView)
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
        // clear head block data when done
        this.headBlock = null
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
        const digest = await CiphUtil.sha256(rawKey)
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
     * @function deriveKey
     *
     * derive key from password and salt
     *
     * @returns {Promise}
     */
    async deriveKey () {
        // derive key from password and salt
        this.key = await CiphUtil.deriveKey(
            CiphUtil.bufferFromString(this.link.password),
            CiphUtil.bufferFromHex(this.link.salt)
        )
        // raw key
        this.keyBuffer = await crypto.subtle.exportKey('raw', this.key)
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
     * @function generateIds
     *
     * generate public and private ids for container
     *
     * @returns {Promise}
     */
    async generateIds () {
        // set public id which is hash of block ids
        this.publicId = await CiphUtil.sha256( CiphUtil.bufferConcat([
            CiphUtil.bufferFromHex(this.link.blockId0),
            CiphUtil.bufferFromHex(this.link.blockId1)
        ]), 'hex', 32)
        // set private id which is hash of block ids and key
        this.privateId = await CiphUtil.sha256( CiphUtil.bufferConcat([
            CiphUtil.bufferFromHex(this.link.blockId0),
            CiphUtil.bufferFromHex(this.link.blockId1),
            this.keyBuffer
        ]), 'hex', 32)
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
        const blockRequestId = `${blockSize} ${blockId0} ${blockId1}`
        // if request is already pending return promise for that request
        if (defined(blockRequests[blockRequestId])) {
            return blockRequests[blockRequestId]
        }
        // store promise when request in progress
        blockRequests[blockRequestId] = Promise.all([
            this.getSubBlock(blockSize, blockId0),
            this.getSubBlock(blockSize, blockId1),
        ]).then(blocks => {
            // clear request when complete
            delete blockRequests[blockRequestId]
            // resolve with XOR of blocks
            return CiphUtil.xorBuffer(blocks[0], blocks[1])
        })
        // return promise that will be resolved with block data
        return blockRequests[blockRequestId]
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
        const digest = await CiphUtil.sha256(buffer)
        assert(CiphUtil.bufferToHex(digest) === file.digest, 'invalid file')

        return buffer
    }

    /**
     * @function getFileDataURI
     *
     * get file, convert to base64, return as data URI
     *
     * @param {string} fileName
     *
     * @returns {Promise<string>}
     */
    async getFileDataURI (fileName) {
        fileName = decodeURI(fileName)
        const file = this.findFile(fileName)
        assert(file, 'file not found')
        // get file data as buffer
        const buffer = await this.getFile(fileName)
        // get mime type from file data or guess
        const mimeType = file.mimeType || CiphUtil.getMimeType(fileName)
        // build data uri from mime type and base64 encoded data
        return `data:${mimeType};base64,${CiphUtil.bufferToBase64(buffer)}`
    }

    /**
     * @function getHeadBlock
     *
     * get and validate head block
     *
     * @returns {Promise}
     */
    async getHeadBlock () {
        // if alread loaded do not reload
        if (this.headBlock) {
            return
        }
        // get and xor component blocks
        this.headBlock = await this.getBlock(
            this.link.blockSize,
            this.link.blockId0,
            this.link.blockId1
        )
        // validate version and content type
        const blockView = new DataView(this.headBlock)
        // get version from block
        this.head.version = blockView.getInt8(0)
        assert(this.head.version === 1, 'invalid version')
        // get content type from block
        this.head.contentType = blockView.getInt8(1)
        assert(this.head.contentType === this.link.contentType, 'content type mismatch')
    }

    /**
     * @function getPage
     *
     * get unzipped page text
     *
     * @returns {string}
     */
    getPage () {
        assert(this.meta && this.meta.type === 'page', 'invalid content type')
        assert(this.dataBuffer, 'dataBuffer is null')
        // decompress page data
        return pako.ungzip(this.dataBuffer, { to: 'string' })
    }

    /**
     * @function getPassword
     *
     * return true if password already set or after prompting
     *
     * @returns {Promise<boolean>}
     */
    async getPassword () {
        // if password already set return true
        if (typeof this.link.password === 'string' && this.link.password.length) {
            return true
        }
        // prompt for password
        this.link.password = prompt('Please enter password')
        // return true if valid password entered
        return typeof this.link.password === 'string' && this.link.password.length ? true : false
    }

    /**
     * @function getReplaceLink
     *
     * get replacement for container if it exists
     *
     * @returns {Promise}
     */
    async getReplaceLink () {
        // get replace link
        const res = await this.get(`/replace?privateId=${this.privateId}`)
        const replace = await res.json()
        // continue unless valid link
        if (typeof replace !== 'string' || !replace.match(secureLinkRegExp)) {
            return
        }
        // get replacement info
        const [blockSize, contentType, blockId0, blockId1, salt] = replace.split('-')
        // update link info
        this.link.blockSize = parseInt(blockSize)
        this.link.contentType = parseInt(contentType)
        this.link.blockId0 = blockId0
        this.link.blockId1 = blockId1
        this.link.salt = salt
        // clear head block if set
        this.headBlock = null
        // derive key from password
        await this.deriveKey()
        // once password loaded set public and private ids
        await this.generateIds()
        // create url for new link
        const url = this.link.passwordInUrl
            ? `/enter#${replace}-${this.link.password}`
            : `/enter#${replace}`
        // replace old url with new url in history
        history.replaceState({}, '', url)
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
        const prefix = blockId.substr(0,3)
        const dataDirNum = Math.floor(parseInt(prefix, 16) / 1024)
        // request block
        const res = await fetch(`${getProxyHost(blockId)}/data/${dataDirNum}/${prefix}/${blockSize}/${blockId}.ciph`, {
            credentials: 'omit',
        })
        // return data if success
        if (res.ok) {
            return res.arrayBuffer()
        }
        // handle errors
        else {
            // retry on error
            if (!retry) {
                // retry
                return this.getSubBlock(blockSize, blockId, true)
            }
            // otherwise throw error
            else {
                throw new Error(res.statusText)
            }
        }
    }

    /**
     * @function loadHead
     *
     * load head block. prompt for password and retry on error.
     *
     * @returns {Promise}
     */
    async loadHead () {
        // retry decrypting head until password correct or canceled
        while (true) {
            if (!await this.loadHeadAttempt()) {
                return
            }
        }
    }

    /**
     * @function loadHeadAttempt
     *
     * load head block. prompt for password. return true to retry on error.
     *
     * @returns {Promise<boolean>}
     */
    async loadHeadAttempt () {
        // cannot load if no password
        if (!await this.getPassword()) {
            return
        }
        // derive key from password
        await this.deriveKey()
        // once password loaded set public and private ids
        await this.generateIds()
        // check if replacement for container exists
        await this.getReplaceLink()
        // download head block
        await this.getHeadBlock()
        // try to decrypt and decode head data
        try {
            // skip first 2 bytes
            const encryptedHead = new DataView(this.headBlock, 2)
            // decrypt head block
            const decryptedHead = await this.decryptBlock(encryptedHead, this.key)
            // extract binary encoded head data
            await this.decodeHead(decryptedHead)
            // exit retry when head loaded
            return
        }
        catch (err) {
            // alert error
            alert(err.message)
            console.error(err)
            // clear password
            link.password = ''
            // return true to show password prompt again
            return true
        }
    }

    static setProxyHost (setProxyHost) {
        proxyHost = setProxyHost
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
 * @function getProxyHost
 *
 * get proxy for serving this block
 *
 * @param {string} blockId
 *
 * @returns {string}
 */
function getProxyHost (blockId) {
    const group = parseInt(blockId.substr(0,3), 16) % 2
    const server = parseInt(blockId.substr(3,3), 16) % 2

    return `https://${proxyServers[group][server]}.ciph.io`
}

})();