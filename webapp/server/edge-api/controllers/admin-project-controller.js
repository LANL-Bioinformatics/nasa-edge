const Project = require('../models/project')
const logger = require('../../utils/logger')
const config = require('../../config')

const sysError = config.APP.API_ERROR

// Find all projects
const getAll = async (req, res) => {
  try {
    logger.debug('/api/admin/projects')
    const projects = await Project.find({ status: { $ne: 'delete' } }).sort([
      ['updated', -1],
    ])

    return res.send({
      projects,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Admin get all projects failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

module.exports = {
  getAll,
}
