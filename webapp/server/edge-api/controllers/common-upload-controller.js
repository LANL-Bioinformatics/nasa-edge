const { updateUpload } = require('../utils/upload')
const logger = require('../../utils/logger')
const config = require('../../config')

const sysError = config.APP.API_ERROR

// Update upload
const updateOne = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/uploads update: ${req.params.code}`)
    let query = { code: { $eq: 'not_found' } }
    if (type === 'user') {
      query = {
        status: { $ne: 'delete' },
        code: { $eq: req.params.code },
        owner: { $eq: req.user.email },
      }
    } else if (type === 'admin') {
      query = { status: { $ne: 'delete' }, code: { $eq: req.params.code } }
    }
    const upload = await updateUpload(query, req)

    if (!upload) {
      logger.error(`upload ${req.params.code} not found or access denied.`)
      return res.status(400).json({
        error: {
          upload: `upload ${req.params.code} not found or access denied`,
        },
        message: 'Action failed',
        success: false,
      })
    }
    return res.send({
      upload,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Update upload failed: ${err}`)

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

module.exports = {
  updateOne,
}
