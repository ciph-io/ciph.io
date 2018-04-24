'use strict'

/* npm modules */
const WebSocket = require('ws')

/* config */
require('./lib/config')

/* app modules */
const Connection = require('./lib/connection')

const server = new WebSocket.Server({
    port: process.env.PORT
})

server.on('connection', (socket, req) => {
    new Connection(socket, req)
})

server.on('error', err => {
    console.error(err)
})

server.on('listening', () => {
    console.log(`listening on ${process.env.PORT}`)
})
