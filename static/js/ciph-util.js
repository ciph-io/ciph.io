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

    static bufferCopy (srcBuffer, dstBuffer, bytes=0, srcOffset=0, dstOffset=0) {
        const srcArr = new Uint8Array(srcBuffer)
        const dstArr = new Uint8Array(dstBuffer)

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