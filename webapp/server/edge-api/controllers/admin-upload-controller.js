const Upload = require('../models/upload')
const logger = require('../../utils/logger')
const config = require('../../config')

const sysError = config.APP.API_ERROR

// Find all uploads
const getAll = async (req, res) => {
  try {
    logger.debug('/api/admin/uploads')
    // find all uploads
    const uploads = await Upload.find({ status: { $ne: 'delete' } }).sort([
      ['updated', -1],
    ])

    return res.json({
      uploads,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Admin get uploads failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

module.exports = {
  getAll,
}
