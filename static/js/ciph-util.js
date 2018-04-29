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