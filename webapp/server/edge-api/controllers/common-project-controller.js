const {
  getProject,
  getProjectConf,
  getProjectOutputs,
  getProjectOutputTreeData,
  getProjectResult,
  getProjectRunStats,
  zipProjectOutputs,
} = require('../utils/project')
const { generateProjectAISummary } = require('../utils/ai-summary')
const logger = require('../../utils/logger')
const config = require('../../config')

const sysError = config.APP.API_ERROR

// Get project
const getOne = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/projects get: ${req.params.code}`)
    // find the project owned by user or shared to user or public
    const project = await getProject(req.params.code, type, req.user)

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
    logger.error(`Get project failed: ${err}`)

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project configuration file
const getConf = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/projects/${req.params.code}/conf`)
    const conf = await getProjectConf(req.params.code, type, req)

    return res.json({
      conf,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`/api/${type}/projects/${req.params.code}/conf failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project result
const getResult = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/projects/${req.params.code}/result`)
    const result = await getProjectResult(req.params.code, type, req)

    return res.json({
      result,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/${type}/projects/${req.params.code}/result failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Generate project result summary with the configured AI provider.
const getAISummary = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/projects/${req.params.code}/aiSummary`)
    const aiSummary = await generateProjectAISummary({
      code: req.params.code,
      type,
      req,
    })

    return res.json({
      summary: aiSummary.summary,
      cached: aiSummary.cached,
      model: aiSummary.model,
      updated: aiSummary.updated,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/${type}/projects/${req.params.code}/aiSummary failed: ${err}`,
    )

    const providerRequestFailed = err.isAxiosError
    const status = err.status || (providerRequestFailed ? 502 : 500)
    let message = sysError
    if (err.status) {
      message = err.message
    } else if (providerRequestFailed) {
      message = 'AI summary provider request failed'
    }

    return res.status(status).json({
      message,
      success: false,
    })
  }
}

// Get project runStats
const getRunStats = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/projects/${req.params.code}/runStats`)
    const runStats = await getProjectRunStats(req.params.code, type, req)

    return res.json({
      runStats,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/${type}/projects/${req.params.code}/runStats failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project output files
const getOutputs = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/projects/${req.params.code}/outputs`)
    const files = await getProjectOutputs(req.params.code, type, req)

    return res.json({
      fileData: files,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/${type}/projects/${req.params.code}/outputs failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project output files
const getOutputTreeData = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/projects/${req.params.code}/outputTreeData`)
    const files = await getProjectOutputTreeData(req.params.code, type, req)

    return res.json({
      fileData: files,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/${type}/projects/${req.params.code}/outputTreeData failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// zip project output files
const downloadOutputs = async (req, res, type) => {
  try {
    logger.debug(`/api/${type}/projects/${req.params.code}/downloadOutputs`)
    const url = await zipProjectOutputs(req.params.code, type, req)

    return res.json({
      zipUrl: url,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/${type}/projects/${req.params.code}/downloadOutputs failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

module.exports = {
  getOne,
  getConf,
  getOutputs,
  getOutputTreeData,
  getResult,
  getAISummary,
  getRunStats,
  downloadOutputs,
}
