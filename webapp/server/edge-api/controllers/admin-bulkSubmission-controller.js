const BulkSubmission = require('../models/bulkSubmission')
const logger = require('../../utils/logger')
const config = require('../../config')

const sysError = config.APP.API_ERROR

// Find all bulkSubmissions
const getAll = async (req, res) => {
  try {
    logger.debug('/api/admin/bulkSubmissions')
    const bulkSubmissions = await BulkSubmission.find({
      status: { $ne: 'delete' },
    }).sort([['updated', -1]])

    return res.send({
      bulkSubmissions,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Admin get all bulkSubmissions failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

module.exports = {
  getAll,
}
