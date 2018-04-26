(function () {
    try {
        // check for class/async/default param/arrow function support
        class Test {
            static async test (args = {}) {
                // test encryption
                const password = new TextEncoder().encode('foo')
                const key = await crypto.subtle.importKey(
                    'raw',
                    password,
                    { name: 'PBKDF2' },
                    false,
                    ['deriveKey']
                )
                const derivedKey = await crypto.subtle.deriveKey(
                    {
                        hash: { name: 'SHA-256' },
                        iterations: 1,
                        name: 'PBKDF2',
                        salt: password,
                    },
                    key,
                    {
                        length: 256,
                        name: 'AES-CTR',
                    },
                    true,
                    ['encrypt', 'decrypt']
                )
                const rawKey = await crypto.subtle.exportKey('raw', derivedKey)
                const digest = await crypto.subtle.digest({ name: 'SHA-256' }, rawKey)
                const counter = digest.slice(0, 16)
                const cipher = await window.crypto.subtle.encrypt(
                    {
                        name: 'AES-CTR',
                        counter: counter,
                        length: 128,
                    },
                    derivedKey,
                    password
                )
                const plain = await window.crypto.subtle.decrypt(
                    {
                        name: 'AES-CTR',
                        counter: counter,
                        length: 128,
                    },
                    derivedKey,
                    cipher
                )
                const testPassword = new TextDecoder().decode(plain)
                if (testPassword !== 'foo') {
                    throw new Error('test did not match')
                }
                if (!window.fetch) {
                    throw new Error('fetch required')
                }
                if (!window.MediaSource) {
                    throw new Error('MediaSource required')
                }
            }
        }

        Test.test().catch(fail)
    }
    catch (err) {
        fail(err)
    }

    function fail (err) {
        var elm = document.getElementById('unsupported-browser')
        elm.setAttribute('style', '')
    }
})()