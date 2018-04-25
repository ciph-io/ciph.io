(function () {

/* exports */
window.CiphUser = class CiphUser {

    constructor (args = {}) {
        this.elmId = args.elmId || 'ciph-user'
        this.elm = document.getElementById(this.elmId)
        assert(this.elm, 'invalid elmId')
        // set default local storage key
        this.localStorageKey = args.localStorageKey || 'ciph-user'
        // user data
        this.data = null
        // promise set when loading
        this.promise = null
        // load user from local storage
        try {
            let userData = localStorage.getItem(this.localStorageKey)
            if (userData) {
                this.data = JSON.parse(userData)
            }
        }
        catch (err) {
            console.error(err)
        }
        // load user then render
        this.refresh()
    }

    async deriveUserIdAndSecret (username, password) {
        // get userid from username and password using PBKDF
        const userIdKey = await CiphUtil.deriveKey(
            CiphUtil.bufferFromString(username),
            CiphUtil.bufferFromString(password)
        )
        const userIdBytes = await crypto.subtle.exportKey('raw', userIdKey)
        // use hash of user id as secret
        const secretBytes = await crypto.subtle.digest({ name: 'SHA-256' }, userIdBytes)
        // return first 32 bytes hex of each
        return {
            userId: CiphUtil.bufferToHex(userIdBytes).substr(0, 32),
            secret: CiphUtil.bufferToHex(secretBytes).substr(0, 32),
        }
    }

    async getUser (force) {
        // if there is stored token and it is not expired then do not request
        if (this.data && this.data.token && !force) {
            // get current time incluing offset between server and browser
            const currentTime = Math.floor(Date.now() / 1000) - this.data.token.offset
            // if current time is still 30 seconds before token expiration
            // do not refresh data
            if (this.data.token.expires - currentTime > 30) {
                this.render()
                return
            }
        }
        // build headers and url for request depending on whether anon or logged in
        const headers = {}
        if (this.data) {
            headers['x-secret'] = this.data.secret
        }
        const url = this.data && this.data.userId ? `/user?userId=${this.data.userId}` : '/user'
        // make request for user info
        const res = await fetch(url, {
            credentials: 'omit',
            headers: headers,
            method: 'GET',
        })

        if (res.status === 200) {
            this.data = await res.json()
            if (this.data.token) {
                // capture offset between server and browser time
                this.data.token.offset = Math.floor(Date.now() / 1000) - this.data.token.time
            }
        }
        else {
            console.error(res)
            alert('User Error')
            this.data = null
        }

        this.store()
        this.render()
    }

    async login () {
        const username = el('ciph-username').value
        const password = el('ciph-password').value
        if (!username.length || !password.length) {
            alert('Username and Password must be provided')
            return
        }
        this.elm.innerHTML = ''

        const user = await this.deriveUserIdAndSecret(username, password)

        // store user info
        this.data = user
        // load user data
        return this.getUser()
    }

    logout () {
        this.data = null
        this.getUser()
    }

    async refresh (force) {
        // if request in progress then use result from the request
        if (this.promise) {
            return this.promise
        }
        // request user - store promise while loading
        this.promise = this.getUser(force).catch(console.error)
        // wait for request to complete
        await this.promise
        // clear promise when done loading
        this.promise = null
    }

    async register () {
        const username = el('ciph-username').value
        const password = el('ciph-password').value
        const confirmPassword = el('ciph-confirm-password').value
        if (!username.length || !password.length) {
            alert('Username and Password must be provided')
            return
        }
        if (password !== confirmPassword) {
            alert('Password and Confirm Password must match')
            return
        }
        this.elm.innerHTML = ''

        const user = await this.deriveUserIdAndSecret(username, password)

        let res = await fetch('/user', {
            body: JSON.stringify(user),
            credentials: 'omit',
            headers: {'content-type': 'application/json'},
            method: 'POST',
        })

        try {
            res = await res.json()
            // response should match post
            if (res.userId === user.userId && res.secret === user.secret) {
                // store user info
                this.data = res
                // load user data
                return this.getUser()
            }
            else {
                alert(res.error === 'userId exists' ? 'Username/Password already used - You must enter a different Username/Password' : 'Register error')
            }
        }
        catch (err) {
            console.error(err)
            alert('Register error')
        }
        // show register form again if not success
        this.renderRegister()
    }

    render () {
        if (!this.elm) {
            return
        }
        if (!this.data) {
            return
        }
        if (this.data.userId) {
            this.renderLoggedIn()
        }
        else {
            this.renderLoggedOut()
        }
    }

    renderLogin () {
        this.elm.innerHTML = `
            <div id="ciph-login" class="ciph-user-form">
                <form id="ciph-login-form">
                    <label>Username:</label><br />
                    <input id="ciph-username" type="text" /><br />
                    <label>Password:</label><br />
                    <input id="ciph-password" type="password" /><br />
                    <button id="ciph-login-cancel" type="button">Cancel</button>
                    <button id="ciph-login-submit" type="submit">Login</button>
                </form>
            </div>
        `
        el('ciph-username').focus()
        el('ciph-login').addEventListener('submit', this.login.bind(this))
        el('ciph-login-cancel').addEventListener('click', () => this.render())
    }

    renderLoggedIn () {
        this.elm.innerHTML = `
            Logged in as: ${this.data.displayUserId}@${this.data.anonId},
            ${this.data.displayCredit} Credit,
            <a id="ciph-logout">Logout</a>
        `
        el('ciph-logout').addEventListener('click', () => this.logout())
    }

    renderLoggedOut () {
        this.elm.innerHTML = `
            Connected as: anon@${this.data.anonId},
            ${this.data.displayCredit} Credit,
            <a id="ciph-login">Log In</a>,
            <a id="ciph-register">Register</a>
        `
        el('ciph-login').addEventListener('click', () => this.renderLogin())
        el('ciph-register').addEventListener('click', () => this.renderRegister())
    }

    renderRegister () {
        this.elm.innerHTML = `
            <div id="ciph-register" class="ciph-user-form">
                <div class="notice">
                Username and password cannot be changed or recovered if lost!
                </div>
                <form id="ciph-register-form">
                    <label>Username:</label><br />
                    <input id="ciph-username" type="text" /><br />
                    <label>Password:</label><br />
                    <input id="ciph-password" type="password" /><br />
                    <label>Confirm Password:</label><br />
                    <input id="ciph-confirm-password" type="password" /><br />
                    <button id="ciph-register-cancel" type="button">Cancel</button>
                    <button id="ciph-register-submit" type="submit">Register</button>
                </form>
            </div>
        `
        el('ciph-username').focus()
        el('ciph-register').addEventListener('submit', this.register.bind(this))
        el('ciph-register-cancel').addEventListener('click', () => this.render())
    }

    store () {
        try {
            localStorage.setItem(this.localStorageKey, JSON.stringify(this.data))
        }
        catch (err) {
            console.error(err)
        }
    }

}

})()