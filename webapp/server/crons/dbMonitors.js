const { exec } = require('child_process')
const dayjs = require('dayjs')
const findRemoveSync = require('find-remove')

const logger = require('../utils/logger')
const config = require('../config')

const dbBackupClean = () => {
  logger.debug('Clean up DB backup')
  const result = findRemoveSync(config.DATABASE.BACKUP_DIR, {
    dir: '^db-backup_',
    regex: true,
    age: { seconds: config.DATABASE.BACKUP_LIFETIME_SECONDS },
  })
  logger.info(result)
}

const dbBackup = () => {
  logger.debug('DB backup')
  // mongodump
  const dateStringWithTime = dayjs(new Date()).format('YYYY-MM-DD:HH:mm')
  const cmd = `mongodump --db ${config.DATABASE.NAME} --out ${config.DATABASE.BACKUP_DIR}/db-backup_${dateStringWithTime}`

  logger.info(cmd)
  // run local
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      logger.error(error.message)
    }
    if (stderr) {
      logger.error(stderr)
    }
  })
}

module.exports = {
  dbBackup,
  dbBackupClean,
}
