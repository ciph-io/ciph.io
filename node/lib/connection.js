'use strict'

/* npm modules */
const WebSocket = require('ws')

/* app modules */
const RedisService = require('./redis-service')
const UserService = require('./user-service')

/* globals */

// index of active connections
const connections = {}
// number increments with each new connection
let connectionNum = 0
// count of connected clients
let connectionCount = 0

// set initial connection count
RedisService.getConnectionCount().then(int => {
    connectionCount = int
})

// send connection count to clients every 5 seconds
setInterval(async () => {
    // get updated connection count
    connectionCount = await RedisService.getConnectionCount()
    // send update count to all connected clients
    for (const connection of Object.values(connections)) {
        // delete connection if closed
        if (connection.socket.readyState === WebSocket.CLOSED) {
            continue
        }
        // skip if not connected
        if (connection.socket.readyState !== WebSocket.OPEN) {
            continue
        }
        // send status
        connection.send({
            online: connectionCount,
            type: 'status'
        })
    }
}, 5000)

// subscribe to chat channel
const chatClient = RedisService.getSubClient('chat')
chatClient.subscribe('chat')
chatClient.on('message', handleMessage)

class Connection {

    constructor (socket, req) {
        // get anon id from ip
        this.anonId = UserService.getAnonId(req.headers['x-real-ip'])
        // index of blocked ids
        this.blocks = {}
        // assign connection number
        this.connectionNum = connectionNum++
        // add connection to global register
        connections[this.connectionNum] = this
        // store socket
        this.socket = socket
        // bind socket event handlers with connection context
        socket.on('close', this.close.bind(this))
        socket.on('error', this.error.bind(this))
        socket.on('message', this.message.bind(this))
        // increment connection count
        RedisService.incrConnectionCount().catch(console.error)
        // load blocks for anon
        RedisService.getAnonBlocks(this.anonId).then(blocks => {
            // if any blocks have already been set merge
            if (Object.keys(this.blocks).length) {
                Object.assign(this.blocks, blocks)
                // resave merged result
                RedisService.setAnonBlocks(this.anonId, this.blocks).catch(console.error)
            }
            else {
                this.blocks = blocks
            }
        }).catch(console.error)
        // send message to client
        this.send({
            online: connectionCount + 1,
            type: 'status',
        })
    }

    close () {
        // decrement connection count
        RedisService.decrConnectionCount().catch(console.error)
        // remove from connections
        delete connections[this.connectionNum]
    }

    error (err) {
        console.error(err)
    }

    message (data) {
        // if data is string should be json
        if (typeof data === 'string') {
            // parse and process message
            try {
                this.messageJson(JSON.parse(data))
            }
            catch (err) {
                console.error(err)
            }
        }
        // otherwise binary
        else {
            this.messageBlob(data)
        }
    }

    messageBlob (data) {

    }

    messageJson (data) {
        switch (data.type) {
            case 'block':
                return this.setBlock(data.anonId, 1)
            case 'message':
                return this.sendChatMessage(data).catch(console.error)
            case 'unblock':
                return this.setBlock(data.anonId, 0)

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

    async sendChatMessage (message) {
        const blockCount = await RedisService.getAnonBlockCount(message.anonId)
        if (blockCount > 5) {
            message.blocked = true
        }
        await RedisService.sendChatMessage(message)
    }

    setBlock (anonId, block) {
        // set block status - use 1|0 since it encodes smaller
        this.blocks[anonId] = block
        // save blocks
        RedisService.setAnonBlocks(anonId, this.blocks).catch(console.error)
        // update block count
        if (block === 1)  {
            RedisService.incrAnonBlockCount(anonId).catch(console.error)
        }
        else {
            RedisService.decrAnonBlockCount(anonId).catch(console.error)
        }
    }
}

module.exports = Connection

/* private methods */

function handleMessage (channel, message) {
    // only handle chat messages
    if (channel !== 'chat') {
        return
    }
    try {
        message = JSON.parse(message)
    }
    catch (err) {
        console.error(err)
        return
    }
    // create blocked copy of message
    const blocked = Object.assign({}, message, {blocked: true})
    // create unblocked copy of message
    const unblocked = Object.assign({}, message, {blocked: false})
    // convert to string for sending
    const blockedJson = JSON.stringify(blocked)
    const messageJson = JSON.stringify(message)
    const unblockedJson = JSON.stringify(unblocked)
    // send message to each connected client
    for (const connection of Object.values(connections)) {
        // skip if not connected
        if (connection.socket.readyState !== WebSocket.OPEN) {
            continue
        }
        // send message to client
        try {
            // if client has blocked/unblocked this id then override default
            if (defined(connection.blocks[message.anonId])) {
                if (connection.blocks[message.anonId] === 1) {
                    connection.socket.send(blockedJson)
                }
                else {
                    connection.socket.send(unblockedJson)
                }
            }
            // otherwise send original message
            else {
                connection.socket.send(messageJson)
            }
        }
        catch (err) {
            console.error(err)
        }
    }
}