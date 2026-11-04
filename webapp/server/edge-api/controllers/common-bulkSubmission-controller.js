const Project = require('../models/project')
const {
  getBulkSubmission,
  getBulkSubmissionConf,
  updateBulkSubmission,
} = require('../utils/bulkSubmission')
const logger = require('../../utils/logger')
const config = require('../../config')

const sysError = config.APP.API_ERROR

// Get bulkSubmission
const getOne = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/bulkSubmissions get: ${req.params.code}`)
    // find the bulkSubmission owned by user or shared to user or public
    const bulkSubmission = await getBulkSubmission(
      req.params.code,
      type,
      req.user,
    )

    if (!bulkSubmission) {
      logger.error(
        `bulkSubmission ${req.params.code} not found or access denied.`,
      )
      return res.status(400).json({
        error: {
          bulkSubmission: `bulkSubmission ${req.params.code} not found or access denied`,
        },
        message: 'Action failed',
        success: false,
      })
    }
    return res.send({
      bulkSubmission,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Get bulkSubmission failed: ${err}`)

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Update bulkSubmission
const updateOne = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/bulkSubmissions update: ${req.params.code}`)
    let query = { code: { $eq: 'not_found' } }
    if (type === 'user') {
      query = {
        code: { $eq: req.params.code },
        status: { $ne: 'delete' },
        owner: { $eq: req.user.email },
      }
    } else if (type === 'admin') {
      query = { code: { $eq: req.params.code }, status: { $ne: 'delete' } }
    }
    const bulkSubmission = await updateBulkSubmission(query, req)

    if (!bulkSubmission) {
      logger.error(
        `bulkSubmission ${req.params.code} not found or access denied.`,
      )
      return res.status(400).json({
        error: {
          bulkSubmission: `bulkSubmission ${req.params.code} not found or access denied`,
        },
        message: 'Action failed',
        success: false,
      })
    }
    return res.send({
      bulkSubmission,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Update bulkSubmission failed: ${err}`)

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get bulkSubmission configuration file
const getConf = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/bulkSubmissions/${req.params.code}/conf`)
    const conf = await getBulkSubmissionConf(req.params.code, type, req)

    return res.json({
      conf,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/${type}/bulkSubmissions/${req.params.code}/conf failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get projects in bulkSubmission
const getProjects = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/bulkSubmissions/${req.params.code}/projects`)
    const bulkSubmission = await getBulkSubmission(
      req.params.code,
      type,
      req.user,
    )

    if (!bulkSubmission) {
      logger.error(
        `bulkSubmission ${req.params.code} not found or access denied.`,
      )
      return res.status(400).json({
        error: {
          projects: `bulkSubmission ${req.params.code} not found or access denied`,
        },
        message: 'Action failed',
        success: false,
      })
    }

    // return projects
    let projects = []
    if (bulkSubmission.projects && bulkSubmission.projects.length > 0) {
      projects = await Project.find({
        code: { $in: bulkSubmission.projects },
      }).sort([['updated', -1]])
    }

    return res.json({
      projects,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/${type}/bulkSubmissions/${req.params.code}/projects failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

module.exports = {
  getOne,
  updateOne,
  getConf,
  getProjects,
}
