const fs = require('fs')
const moment = require('moment')
const Upload = require('../edge-api/models/upload')
const User = require('../edge-api/models/user')
const logger = require('../utils/logger')
const config = require('../config')

const fileUploadMonitor = async () => {
  logger.debug('file upload monitor')
  try {
    // delete file after deleteGracePeriod
    const deleteGracePeriod = moment().subtract(
      config.FILE_UPLOADS.DELETION_GRACE_PERIOD_DAYS,
      'days',
    )
    let uploads = await Upload.find({
      status: 'delete',
      updated: { $lte: deleteGracePeriod },
    })
    let i
    for (i = 0; i < uploads.length; i += 1) {
      const { code, owner, folder, name } = uploads[i]
      // delete file
      const path = `${config.IO.UPLOADED_FILES_DIR}/${code}`
      logger.info(`deleted ${path}`)
      try {
        fs.unlinkSync(path)
      } catch (e) {
        // Ignores all deletion errors
      }
      // delete from database
      Upload.deleteOne({ code }, err => {
        if (err) {
          logger.info(`Failed to delete upload ${code}:${err}`)
        }
      })

      // check if user folder is enabled
      if (config.FILE_UPLOADS.USER_FOLDER_IS_ENABLED) {
        // eslint-disable-next-line no-await-in-loop
        const user = await User.findOne({ email: owner })
        if (user) {
          // find user upload link and delete it
          const userUploadLink = `${config.IO.UPLOADED_USER_DIR}/${user.id}/${folder.trim().replace(/\s+/g, '_')}/${name}`
          logger.info(`deleting user upload link ${userUploadLink}`)
          try {
            fs.unlinkSync(userUploadLink)
          } catch (e) {
            // Ignores all deletion errors
          }
        }
      }
    }

    // change status to 'delete' if upload is older than daysKept
    const daysKept = moment().subtract(
      config.FILE_UPLOADS.FILE_LIFETIME_DAYS,
      'days',
    )
    uploads = await Upload.find({ status: 'live', created: { $lte: daysKept } })
    for (i = 0; i < uploads.length; i += 1) {
      const { code } = uploads[i]
      logger.info(`mark file for deleting ${code}`)
      Upload.findOne({ code }).then(upload => {
        if (!upload) {
          logger.error(`Upload not found ${code}`)
        } else {
          upload.status = 'delete'
          upload
            .save()
            .then()
            .catch(err => {
              logger.error(`Failed to update upload ${code}:${err}`)
            })
        }
      })
    }
  } catch (err) {
    logger.error(`fileUploadMonitor failed:${err}`)
  }
}

module.exports = {
  fileUploadMonitor,
}
