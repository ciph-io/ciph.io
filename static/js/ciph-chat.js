(function () {

'use strict'

/* globals */
const ciphLinksRegExp = /ciph:\/\/\d-\d-[a-f0-9]{32}-[a-f0-9]{32}-[a-f0-9]{32}(-[a-f0-9]{64})?/g
const contentTypeNames = ['Collection', 'Page', 'Video', 'Audio', 'Image']
const httpLinksRegExp = /https:\/\/(dev\.)?ciph\.io\/enter.*?#\d-\d-[a-f0-9]{32}-[a-f0-9]{32}-[a-f0-9]{32}(-[a-f0-9]{64})?/g

/* exports */
window.CiphChat = class CiphChat {

    constructor (args = {}) {
        // initialize chat element where html will be rendered
        this.elmId = args.elmId || 'ciph-chat'
        this.elm = document.getElementById(this.elmId)
        assert(this.elm, 'invalid elmId')
        // set user using global default
        this.user = ciphUser || window.ciphUser

        // get seen intro flag from local storage
        const seenIntro = localStorage.getItem('chat-intro')

        // index of blocked ids
        this.blocks = {}
        // timeouts set to clear messages
        this.clearMessageTimeouts = []
        // set to true when chat view is in expanded state
        this.expanded = false
        // set to false once opened for the first time
        this.first = true
        // set to true when chat is hidden
        this.hidden = false
        // set true once connected
        this.initialized = false
        // maximum message history to keep
        this.maxMessages = 100
        // queue of recieved messages
        this.messages = []
        // message number for assigning local id
        this.messageNum = 0
        // count of new messages when hidden
        this.new = 0
        // socket will be set on connect
        this.socket = null
        // connect to chat server or show intro if not seen
        this.promise = this.connect()
    }

    block (messageId) {
        // find message by id
        const message = this.messages.find(message => message.id === messageId)
        // message must exist
        if (!message) {
            return
        }
        // send block to server
        this.send({ anonId: message.anonId, type: 'block' })
        // set id as blocked
        this.blocks[message.anonId] = true
        // rerender messages as blocked
        this.setBlockAll(message.anonId, true)
    }

    close () {
        // attempt reconnect on close after waiting a bit
        setTimeout(() => {
            this.connect().catch(console.error)
        }, 1000)
    }

    collapse () {
        el('ciph-chat-messages').innerHTML = ''
        el('ciph-chat-collapse').classList.add('hide')
        el('ciph-chat-expand').classList.remove('hide')
        this.expanded = false
        this.setChatMessagesHeight()
    }

    async connect () {
        // wait for user to be loaded
        await this.user.promise
        // require user data to be loaded
        if (!this.user.data || !this.user.data.anonId) {
            return
        }
        // get chat host based on anon id (ip)
        const chatHost = this.getChatHost(this.user.data.anonId)
        // connect
        this.socket = new WebSocket(`${chatHost}/chat`)
        // add event listenders
        this.socket.addEventListener('close', this.close.bind(this))
        this.socket.addEventListener('message', this.message.bind(this))
        this.socket.addEventListener('open', this.open.bind(this))
    }

    createMessageElm (message) {
        const elm = ce('div')
        elm.setAttribute('id', message.id)
        elm.classList.add('bubble')
        // get message
        let body = message.message
        // replace ciph links
        const ciphLinks = body.match(ciphLinksRegExp)
        // replace link text with a tag that opens content
        if (ciphLinks) {
            for (const link of ciphLinks) {
                const [, ciphLink] = link.match(/^ciph:\/\/([\w-]+)/)
                const [, type] = ciphLink.split('-')
                // skip if invalid content type
                if (!defined(contentTypeNames[type])) {
                    continue
                }
                body = body.replace(link, `<a href="https://ciph.io/enter#${ciphLink}" onclick="ciphBrowser.open('${ciphLink}', event)">Ciph ${contentTypeNames[type]}</a>`)
            }            
        }
        // replace http links
        const httpLinks = body.match(httpLinksRegExp)
        // replace link text with a tag that opens content
        if (httpLinks) {
            for (const link of httpLinks) {
                const [, ciphLink] = link.match(/#([\w-]+)/)
                const [, type] = ciphLink.split('-')
                // skip if invalid content type
                if (!defined(contentTypeNames[type])) {
                    continue
                }
                body = body.replace(link, `<a href="${link}" onclick="ciphBrowser.open('${ciphLink}', event)">Ciph ${contentTypeNames[type]}</a>`)
            }            
        }
        // our own message
        if (message.anonId === this.user.data.anonId) {
            elm.classList.add('you')
            elm.innerHTML = `
                <div class="from">You</div>
                <div class="message">${body}</div>
            `
        }
        // message from someone else
        else {
            if (message.blocked || this.blocks[message.anonId]) {
                elm.classList.add('blocked')
                elm.innerHTML = `
                    <div class="from">
                        anon@${message.anonId}
                        - <a onclick="ciphChat.unblock('${message.id}')" class="pointer">Unblock</a>
                    </div>
                `
            }
            else {
                elm.innerHTML = `
                    <div class="from">
                        anon@${message.anonId}
                        - <a onclick="ciphChat.block('${message.id}')" class="pointer">Block</a>
                    </div>
                    <div class="message">${body}</div>
                `
            }
        }

        return elm
    }

    expand () {
        el('ciph-chat-collapse').classList.remove('hide')
        el('ciph-chat-expand').classList.add('hide')
        this.expanded = true
        // clear all pending timeouts
        for (const timeout of this.clearMessageTimeouts) {
            clearTimeout(timeout)
        }
        this.clearMessageTimeouts = []
        // get message div
        const chatMessagesElm = el('ciph-chat-messages')
        // empty
        chatMessagesElm.innerHTML = ''
        // add all messages to div
        for (const message of this.messages) {
            chatMessagesElm.appendChild(this.createMessageElm(message))
        }
        this.setChatMessagesHeight()
    }

    getChatHost (anonId) {
        if (location.host === 'dev.ciph.io') {
            return 'wss://dev.ciph.io'
        }
        else {
            return 'wss://chat-1.ciph.io'
        }
    }

    hide () {
        if (this.expanded) {
            this.collapse()
        }
        el('ciph-chat-input').classList.add('hide')
        el('ciph-chat-messages').classList.add('hide')
        el('ciph-chat-status-messages').classList.remove('hide')
        el('ciph-chat-show').classList.remove('hide')
        this.hidden = true
    }

    intro () {
        // list of intro messages to show user
        const introMessages = [
            {
                anonId: 'ciph',
                delay: 1500,
                id: 'intro-message-1',
                message: 'Welcome to Ciph',
            },
            {
                anonId: 'ciph',
                delay: 2500,
                id: 'intro-message-2',
                message: 'Chat lets you talk to other users and search for content',
            },
            {
                anonId: 'ciph',
                delay: 3000,
                id: 'intro-message-3',
                message: 'Ciph chat is unmonitored and uncensored',
            },
            {
                anonId: 'ciph',
                delay: 3000,
                id: 'intro-message-3',
                message: 'You can block users by clicking "Block" next to the user id',
            },
            {
                anonId: 'ciph',
                delay: 1000,
                id: 'intro-message-4',
                message: 'To search type "search" like ...',
            },
            {
                anonId: 'ciph',
                delay: 2000,
                id: 'intro-message-5',
                message: 'search for this',
            },
            {
                anonId: 'ciph',
                delay: 3000,
                id: 'intro-message-6',
                message: 'Ciph search is open source which means that anyone can respond to your search',
            },
            {
                anonId: 'ciph',
                delay: 3000,
                id: 'intro-message-7',
                message: 'all search results come from other users not from Ciph',
            },
        ]
        return new Promise(resolve => {
            let delay = 1000
            // show each intro message with delay between then
            for (let i=0; i<introMessages.length; i++) {
                const message = introMessages[i]
                setTimeout(() => {
                    // add message to div
                    el('ciph-chat-messages').appendChild(this.createMessageElm(message))
                    // clear message after timeout
                    this.setClearMessageTimeout(message.id)
                    // add to list of messages
                    this.messages.push(message)
                    // if this is the last message then connect to chat
                    if (i+1 === introMessages.length) {
                        // set flag so intro wont be repeated
                        localStorage.setItem('chat-intro', 1)
                        // resolve promise with connection
                        resolve(this.connect())
                    }
                }, delay)
                // show next message 4 seconds later
                delay += message.delay
            }
        })
    }

    initialize () {
        // add handler for form input
        el('ciph-chat-input-form').addEventListener('submit', this.sendMessage.bind(this))
        // show input
        el('ciph-chat-input').classList.remove('hide')
        // add control click handlers
        el('ciph-chat-collapse').addEventListener('click', this.collapse.bind(this))
        el('ciph-chat-expand').addEventListener('click', this.expand.bind(this))
        el('ciph-chat-hide').addEventListener('click', this.hide.bind(this))
        el('ciph-chat-show').addEventListener('click', this.show.bind(this))
        // set max height of message div
        this.setChatMessagesHeight()
        // reset max height if window size changed
        window.addEventListener('resize', () => this.setChatMessagesHeight())
        // set state to initialized
        this.initialized = true
    }

    message (ev) {
        // string must be json
        if (typeof ev.data === 'string') {
            try {
                this.messageJson(JSON.parse(ev.data))
            }
            catch (err) {
                console.error(err)
            }
        }
        // otherwise blob
        else {
            this.messageBlob(ev.data)
        }
    }

    messageBlob (data) {

    }

    messageJson (data) {
        switch (data.type) {
            case 'message':
                return this.messageMessage(data)
            case 'status':
                return this.messageStatus(data)
        }
    }

    messageMessage (message) {
        // create local id for message
        message.id = `msg-${this.messageNum++}`
        // add message to list
        this.messages.push(message)
        // remove old message if list exceeds max length
        if (this.messages.length > this.maxMessages) {
            const oldMessage = this.messages.shift()
            const oldMessageElm = el(oldMessage.id)
            if (oldMessageElm) {
                oldMessageElm.parentNode.removeChild(oldMessageElm)
            }
        }
        // if chat is hidden only update count
        if (this.hidden) {
            this.new++
            el('ciph-chat-status-messages').textContent = `${this.new} New`

        }
        // otherwise add message
        else {
            // add message to div
            el('ciph-chat-messages').appendChild(this.createMessageElm(message))
            // scroll to bottom if needed
            this.setScroll()
            // unless window is expanded clear message after 5 seconds
            if (!this.expanded) {
                this.setClearMessageTimeout(message.id)
            }
        }
    }

    messageStatus (data) {
        el('ciph-chat-status-online').textContent = `${data.online} Online`

        if (!this.initialized) {
            this.initialize()
        }
    }

    open (ev) {
        if (this.first) {
            if (window.innerWidth > 900) {
                this.expand()
            }
            this.first = false
        }
    }

    send (data) {
        try {
            if (typeof data === 'object') {
                this.socket.send(JSON.stringify(data))
            }
            else {
                this.socket.send(data)
            }
        }
        catch (err) {
            console.error(err)
        }
    }

    sendMessage (ev) {
        ev.preventDefault()
        // get message
        const message = el('ciph-chat-message').value
        // do nothing if no message
        if (!message.length) {
            return
        }
        // empty message input on send
        el('ciph-chat-message').value = ''
        // send message
        this.send({
            anonId: this.user.data.anonId,
            message: message,
            type: 'message',
        })
    }

    setBlockAll (anonId, blocked) {
        // set block status on all messages from id
        for (const message of this.messages) {
            // skip unless message is from id
            if (message.anonId !== anonId) {
                continue
            }
            // set blocked status on message
            message.blocked = blocked
            // get message element
            const messageElm = el(message.id)
            // skip unless element found
            if (!messageElm) {
                continue
            }
            // replace element with updated message
            messageElm.parentNode.replaceChild(this.createMessageElm(message), messageElm)
        }
    }

    setChatMessagesHeight () {
        // get max height for chat messages inside the ciph-chat div
        const maxHeight = window.innerHeight - (el('ciph-chat-status').clientHeight + el('ciph-chat-input').clientHeight) - 12
        // if window is expanded set max height as height
        if (this.expanded) {
            // set max-height style on messages div
            el('ciph-chat-messages').setAttribute('style', `height: ${maxHeight}px`)
        }
        else {
            // set max-height style on messages div
            el('ciph-chat-messages').setAttribute('style', `max-height: ${maxHeight}px`)
        }
        // scroll to bottom after setting height
        this.setScroll()
    }

    setClearMessageTimeout (messageId) {
        // set timeout to clear message
        const timeout = setTimeout(() => {
            // get message element
            const messageElm = el(messageId)
            // remove from dom if found
            if (messageElm) {
                messageElm.parentNode.removeChild(messageElm)
            }
            // remove timeout from pending list
            this.clearMessageTimeouts = this.clearMessageTimeouts
                .filter(pendingTimeout => pendingTimeout !== timeout)
        }, 5000)
        // add timeout to pending list
        this.clearMessageTimeouts.push(timeout)
    }

    setScroll () {
        const messagesElm = el('ciph-chat-messages')
        messagesElm.scrollTop = messagesElm.scrollHeight - messagesElm.clientHeight
    }

    show () {
        el('ciph-chat-input').classList.remove('hide')
        el('ciph-chat-messages').classList.remove('hide')
        el('ciph-chat-status-messages').classList.add('hide')
        el('ciph-chat-status-messages').textContent = ''
        el('ciph-chat-show').classList.add('hide')
        this.hidden = false
        // limit new to queued messages
        if (this.new > this.messages.length) {
            this.new = this.messages.length
        }
        // if there are new messages show them
        if (this.new > 0) {
            const chatMessagesElm = el('ciph-chat-messages')
            for (let i=this.messages.length-this.new; i < this.messages.length; i++) {
                const message = this.messages[i]
                chatMessagesElm.appendChild(this.createMessageElm(message))
                this.setClearMessageTimeout(message.id)
            }
        }
        this.new = 0
    }

    unblock (messageId) {
        // find message by id
        const message = this.messages.find(message => message.id === messageId)
        // message must exist
        if (!message) {
            return
        }
        // send unblock to server
        this.send({ anonId: message.anonId, type: 'unblock' })
        // set id as unblocked
        this.blocks[message.anonId] = false
        // rerender messages as unblocked
        this.setBlockAll(message.anonId, false)
    }

}

})()