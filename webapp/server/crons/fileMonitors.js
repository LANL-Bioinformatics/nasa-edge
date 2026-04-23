const findRemoveSync = require('find-remove')
const logger = require('../utils/logger')
const config = require('../config')

const cleanupTempFiles = () => {
  const tempDir = config.IO.TMP_BASE_DIR
  logger.debug(`Cleaning up temp files in: ${tempDir}`)
  const ONE_HOUR = 60 * 60 // seconds
  findRemoveSync(tempDir, {
    dir: '^[a-zA-Z0-9]{8}$', // match the tmp dir created for zip files
    regex: true,
    age: { seconds: ONE_HOUR },
  })
}

module.exports = {
  cleanupTempFiles,
}
