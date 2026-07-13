const fs = require('fs')
const path = require('path')
const Project = require('../models/project')
const {
  getProject,
  getProjectConf,
  updateProject,
  getProjectOutputs,
  getProjectBatchOutputs,
  getProjectResult,
  getProjectRunStats,
} = require('../utils/project')
const logger = require('../../utils/logger')
const { linkCopyFile } = require('../../utils/common')
const config = require('../../config')
const { workflowList } = require('../../workflow/util')

const sysError = config.APP.API_ERROR

// Get project
const getOne = async (req, res) => {
  try {
    logger.debug(`/api/admin/projects get: ${req.params.code}`)
    // find the project by code
    const project = await getProject(req.params.code, 'admin', req.user)

    if (!project) {
      logger.error(`project ${req.params.code} not found or access denied.`)
      return res.status(400).json({
        error: {
          project: `project ${req.params.code} not found or access denied`,
        },
        message: 'Action failed',
        success: false,
      })
    }
    // get report/log file if project is failed or complete
    let report = null
    if (project.status === 'failed' || project.status === 'complete') {
      const projHome = `${config.IO.PROJECT_BASE_DIR}/${project.code}`
      // eslint-disable-next-line no-nested-ternary
      const reportPath = fs.existsSync(
        `${projHome}/${workflowList[project.type].report}`,
      )
        ? `${projHome}/${workflowList[project.type].report}`
        : fs.existsSync(`${projHome}/${workflowList[project.type].log}`)
          ? `${projHome}/${workflowList[project.type].log}`
          : null

      if (reportPath) {
        // create project directory in EXECUTION_REPORTS if not exist
        if (!fs.existsSync(`${config.IO.EXECUTION_REPORTS}/${project.code}`)) {
          fs.mkdirSync(`${config.IO.EXECUTION_REPORTS}/${project.code}`, {
            recursive: true,
          })
        }
        if (
          !fs.existsSync(
            `${config.IO.EXECUTION_REPORTS}/${project.code}/${path.basename(reportPath)}`,
          )
        ) {
          await linkCopyFile(
            reportPath,
            `${config.IO.EXECUTION_REPORTS}/${project.code}`,
            'link',
            false,
          )
        }
        report = `${process.env.EXECUTION_REPORTS_API_PATH}/${project.code}/${path.basename(reportPath)}`
      }
    }

    return res.send({
      project,
      report,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Admin get project failed: ${err}`)

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Update project
const updateOne = async (req, res) => {
  try {
    logger.debug(`/api/admin/projects update: ${req.params.code}`)
    const query = { code: { $eq: req.params.code }, status: { $ne: 'delete' } }
    const project = await updateProject(query, req)

    if (!project) {
      logger.error(`project ${req.params.code} not found or access denied.`)
      return res.status(400).json({
        error: {
          project: `project ${req.params.code} not found or access denied`,
        },
        message: 'Action failed',
        success: false,
      })
    }
    return res.send({
      project,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Admin update project failed: ${err}`)

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project configuration file
const getConf = async (req, res) => {
  try {
    logger.debug(`/api/admin/projects/${req.params.code}/conf`)
    const conf = await getProjectConf(req.params.code, 'admin', req)

    return res.json({
      conf,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`/api/admin/projects/${req.params.code}/conf failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project result
const getResult = async (req, res) => {
  try {
    logger.debug(`/api/admin/projects/${req.params.code}/result`)
    const result = await getProjectResult(req.params.code, 'admin', req)

    return res.json({
      result,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`/api/admin/projects/${req.params.code}/result failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project runStats
const getRunStats = async (req, res) => {
  try {
    logger.debug(`/api/admin/projects/${req.params.code}/runStats`)
    const runStats = await getProjectRunStats(req.params.code, 'admin', req)

    return res.json({
      runStats,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/admin/projects/${req.params.code}/runStats failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

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

// Get project output files
const getOutputs = async (req, res) => {
  try {
    logger.debug(`/api/admin/projects/${req.params.code}/outputs`)
    const files = await getProjectOutputs(req.params.code, 'admin', req)

    return res.json({
      fileData: files,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/admin/projects/${req.params.code}/outputs failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get all output files in subprojects
const getBatchOutputs = async (req, res) => {
  try {
    logger.debug(`/api/admin/projects/${req.params.code}/batch/outputs`)
    const files = await getProjectBatchOutputs(req.params.code, 'admin', req)

    return res.json({
      fileData: files,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/admin/projects/${req.params.code}/batch/outputs failed: ${err}`,
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
  getAll,
  getOutputs,
  getBatchOutputs,
  getResult,
  getRunStats,
}
