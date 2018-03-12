'use strict'

/* native modules */
const path = require('path')

/* npm modules */
const fs = require('mz/fs')
const randomInt = require('random-int')

/* app modules */
const assert = require('./assert')

/* globals */

// directory names for each block size
const blockSizes = ['s', 'm', 'l']
// buffer for reading filename from index
const fileNameBuffer = Buffer.alloc(32)
// arrays of index file handles
const indexFileHandles = { s: [], m: [], l: [] }
// arrays of the number of entries in each index
const indexSizes = { s: [], m: [], l: [] }

/* exports */
module.exports = class IndexService {

    /**
     * @function refreshIndex
     *
     * get/store the length of each index file. This is used to pick a random
     * block.
     *
     */
    static async refreshIndex () {
        // update stored file size for each index file
        for (let i=0; i < 256; i++) {
            // get hex dirname
            const dirName = i.toString('16').padStart(2, '0')
            // iterate through each file size
            for (let blockSize of blockSizes) {
                const indexFile = path.resolve(process.env.DATA_ROOT, dirName, blockSize, 'index.ciph')
                // get length of index file
                try {
                    const stat = await fs.stat(indexFile)
                    // record number of entries - each is 32byte + newline
                    indexSizes[blockSize][i] = stat.size / 33
                }
                catch (err) {
                    console.error(err)
                }
                // open file hanlde for file
                try {
                    // close file handle if already open
                    if (indexFileHandles[blockSize][i]) {
                        await fs.close(indexFileHandles[blockSize][i])
                    }
                    // open file handle
                    indexFileHandles[blockSize][i] = await fs.open(indexFile, 'r')
                }
                catch (err) {
                    console.error(err)
                }
            }
        }
    }

    /**
     * @getRandomFile
     *
     * get a random file of specified size from index
     *
     * @param {string} blockSize
     *
     * @returns {Promise<string>}
     */
    static async getRandomFile (blockSize) {
        assert(indexSizes[blockSize], 'invalid block size')
        // get number between 0-255 - this is not really random!
        // the security implications need to be further evaluated
        const randIndex = randomInt(255)
        // get random file
        const indexSize = indexSizes[blockSize][randIndex]
        const randFile = randomInt(indexSize-1)
        // position to read from is file number times length (32byte + newline)
        const position = randFile * 33
        // read file into pre-allocated global buffer
        await fs.read(indexFileHandles[blockSize][randIndex], fileNameBuffer, 0, 32, position)
        // get hex dirname
        const dirName = randIndex.toString('16').padStart(2, '0')

        return fileNameBuffer.toString()
    }

    /**
     * @function init
     *
     * load data and set intervals to refresh
     */
    static async init () {
        // set index files sizes for the first time
        await refreshIndex()
        // do refresh every 5 minutes
        setInterval(refreshIndexFilesSizes, process.env.INDEX_REFRESH_INTERVAL)
    }

}
