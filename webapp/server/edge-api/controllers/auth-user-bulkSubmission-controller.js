const randomize = require('randomatic')
const fs = require('fs')
const BulkSubmission = require('../models/bulkSubmission')
const Project = require('../models/project')
const {
  getBulkSubmission,
  getBulkSubmissionConf,
  updateBulkSubmission,
} = require('../utils/bulkSubmission')
const logger = require('../../utils/logger')
const config = require('../../config')

// Promisified express-fileupload move. file.mv(dest, cb) returns undefined, so
// `await file.mv(...)` does not wait, and a `throw` inside the callback runs on a
// later tick — escaping the surrounding try/catch and killing the worker, which the
// client sees as a 405. Wrapping it makes failures catchable (clean 500) and makes
// the response wait until the file is actually on disk.
const mvAsync = (f, dest) =>
  new Promise((resolve, reject) => {
    f.mv(dest, err => (err ? reject(err) : resolve()))
  })


const sysError = config.APP.API_ERROR

// Create a bulkSubmission
const addOne = async (req, res) => {
  try {
    const data = req.body
    logger.debug(`/api/auth-user/bulkSubmissions add: ${JSON.stringify(data)}`)

    if (typeof data.bulkSubmission === 'string') {
      data.bulkSubmission = JSON.parse(data.bulkSubmission)
    }
    if (typeof data.bulkfile === 'string') {
      data.bulkfile = JSON.parse(data.bulkfile)
    }
    if (typeof data.inputDisplay === 'string') {
      data.inputDisplay = JSON.parse(data.inputDisplay)
    }

    // generate bulkSubmission code and create bulkSubmission home
    let code = randomize('Aa0', 16)
    let bulkHome = `${config.IO.BULKSUBMISSION_BASE_DIR}/${code}`
    while (fs.existsSync(bulkHome)) {
      code = randomize('Aa0', 16)
      bulkHome = `${config.IO.BULKSUBMISSION_BASE_DIR}/${code}`
    }

    const bulkName = data.bulkSubmission.name
    const bulkDesc = data.bulkSubmission.desc
    const bulkType = data.bulkSubmission.type
    const fileName = data.bulkfile.name

    fs.mkdirSync(bulkHome)
    fs.writeFileSync(`${bulkHome}/conf.json`, JSON.stringify(data))

    // save uploaded excel file to bulkSubmission home
    if (req.files) {
      const { file } = req.files
      const mvTo = `${bulkHome}/${file.name}`
      await mvAsync(file, `${mvTo}`)
      logger.debug(`upload to: ${mvTo}`)
    }

    const newBulkSubmission = new BulkSubmission({
      name: bulkName,
      desc: bulkDesc,
      type: bulkType,
      filename: fileName,
      owner: req.user.email,
      code,
    })
    const bulkSubmission = await newBulkSubmission.save()
    return res.send({
      bulkSubmission,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Add bulkSubmission failed: ${err}`)

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get bulkSubmission
const getOne = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/bulkSubmissions get: ${req.params.code}`)
    // find the bulkSubmission owned by user or shared to user or public
    const bulkSubmission = await getBulkSubmission(
      req.params.code,
      'user',
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
const updateOne = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/bulkSubmissions update: ${req.params.code}`)
    const query = {
      code: { $eq: req.params.code },
      status: { $ne: 'delete' },
      owner: { $eq: req.user.email },
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
const getConf = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/bulkSubmissions/${req.params.code}/conf`)
    const conf = await getBulkSubmissionConf(req.params.code, 'user', req)

    return res.json({
      conf,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/auth-user/bulkSubmissions/${req.params.code}/conf failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Find all bulkSubmissions owned by user
const getOwn = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/bulkSubmissions: ${req.user.email}`)
    const bulkSubmissions = await BulkSubmission.find({
      type: { $ne: 'sra2fastq' },
      status: { $ne: 'delete' },
      owner: { $eq: req.user.email },
    }).sort([['updated', -1]])

    return res.send({
      bulkSubmissions,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`List user bulkSubmissions failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get projects in bulkSubmission
const getProjects = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/bulkSubmissions/${req.params.code}/projects`)
    const bulkSubmission = await getBulkSubmission(
      req.params.code,
      'user',
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
      `/api/auth-user/bulkSubmissions/${req.params.code}/projects failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

module.exports = {
  addOne,
  getOne,
  updateOne,
  getConf,
  getOwn,
  getProjects,
}
