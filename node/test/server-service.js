'use strict'

/* native modules */
const path = require('path')

/* init test env */
require('./helpers/init-test-env')

/* init global app config */
process.env.SERVER_CONF_FILE = path.resolve(__dirname, 'servers.json')

require('../lib/config')

/* app modules */

const RedisService = require('../lib/redis-service')
const ServerService = require('../lib/server-service')

describe('ServerService', () => {

    after(async () => {
        await RedisService.disconnectAll()
    })

    describe('getDataServer', () => {

        it('should return servers for block id', () => {
            let servers = ServerService.getDataServer('aa249a9a0a285514f363e27aa5353378')
            assert.strictEqual(servers.id, '1')

            servers = ServerService.getDataServer('ab249a9a0a285514f363e27aa5353378')
            assert.strictEqual(servers.id, '2')

        })

    })

    describe('getServers', () => {

        it('should return servers by type', () => {
            const webServers = ServerService.getServers('web')
            assert.strictEqual(webServers.length, 1)
            assert.strictEqual(webServers[0].id, '0')

            const dataServers = ServerService.getServers('data')
            assert.strictEqual(dataServers.length, 2)
            assert.strictEqual(dataServers[0].id, '1')
            assert.strictEqual(dataServers[1].id, '2')

            const proxyServers = ServerService.getServers('proxy')
            assert.strictEqual(proxyServers.length, 3)
            assert.strictEqual(proxyServers[0].id, '3')
            assert.strictEqual(proxyServers[1].id, '4')
            assert.strictEqual(proxyServers[2].id, '5')
        })

        it('should return servers for block with 2 char prefix and 2 shards', () => {
            // get servers for aa (170) prefix
            let servers = ServerService.getServers('data', 'aa249a9a0a285514f363e27aa5353378')
            assert.strictEqual(servers.length, 1)
            assert.strictEqual(servers[0].id, '1')
            // get servers for ab (171) prefix
            servers = ServerService.getServers('data', 'ab249a9a0a285514f363e27aa5353378')
            assert.strictEqual(servers.length, 1)
            assert.strictEqual(servers[0].id, '2')
        })

        it('should return servers for block with 3 char prefix and 3 shards', () => {
            // get servers for aa1 (2721) prefix
            let servers = ServerService.getServers('proxy', 'aa149a9a0a285514f363e27aa5353378')
            assert.strictEqual(servers.length, 1)
            assert.strictEqual(servers[0].id, '3')
            // get servers for aa2 (2722) prefix
            servers = ServerService.getServers('proxy', 'aa249a9a0a285514f363e27aa5353378')
            assert.strictEqual(servers.length, 1)
            assert.strictEqual(servers[0].id, '4')
            // get servers for aa3 (2723) prefix
            servers = ServerService.getServers('proxy', 'aa349a9a0a285514f363e27aa5353378')
            assert.strictEqual(servers.length, 1)
            assert.strictEqual(servers[0].id, '5')
        })

        it('should generate stable shards', () => {
            const hexChars = [0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f']
            // generate 2 char hex codes
            const twoChar = []

            for (const a of hexChars) {
                for (const b of hexChars) {
                    const hexCode = `${a}${b}`
                    twoChar.push({
                        hex: hexCode,
                        int: parseInt(hexCode, 16),
                    })
                }
            }

            const shard0 = []
            const shard1 = []

            for (const shard of twoChar) {
                if (shard.int % 2 == 0) {
                    shard0.push(shard)
                }
                else if (shard.int % 2 == 1) {
                    shard1.push(shard)
                }
            }

            assert.strictEqual(shard0.length, 128)
            assert.strictEqual(shard1.length, 128)
            assert.strictEqual(shard0.length + shard1.length, twoChar.length)

            const threeChar = []

            for (const a of hexChars) {
                for (const b of hexChars) {
                    for (const c of hexChars) {
                        const hexCode = `${a}${b}${c}`
                        threeChar.push({
                            hex: hexCode,
                            int: parseInt(hexCode, 16),
                        })
                    }
                }
            }

            const shardA = []
            const shardB = []
            const shardC = []

            for (const shard of threeChar) {
                if (shard.int % 3 == 0) {
                    shardA.push(shard)
                }
                else if (shard.int % 3 == 1) {
                    shardB.push(shard)
                }
                else if (shard.int % 3 == 2) {
                    shardC.push(shard)
                }
            }

            assert.strictEqual(shardA.length, 1366)
            assert.strictEqual(shardB.length, 1365)
            assert.strictEqual(shardC.length, 1365)
            assert.strictEqual(shardA.length + shardB.length + shardC.length, threeChar.length)

        })

    })

})