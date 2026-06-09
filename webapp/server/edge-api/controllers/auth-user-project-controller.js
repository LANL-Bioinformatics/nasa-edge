const randomize = require('randomatic')
const fs = require('fs')
const moment = require('moment')
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
const { getAllFiles } = require('../../utils/common')
const { workflowList } = require('../../workflow/util')
const logger = require('../../utils/logger')
const config = require('../../config')
const { localWorkflowMonitor } = require('../../crons/localMonitors')

const sysError = config.APP.API_ERROR

// Create a project
const addOne = async (req, res) => {
  try {
    const data = req.body
    logger.debug(`/api/auth-user/projects add: ${JSON.stringify(data)}`)

    if (typeof data.project === 'string') {
      data.project = JSON.parse(data.project)
    }
    if (typeof data.workflow === 'string') {
      data.workflow = JSON.parse(data.workflow)
    }
    if (typeof data.inputDisplay === 'string') {
      data.inputDisplay = JSON.parse(data.inputDisplay)
    }

    // generate project code and create project home
    let code = randomize('Aa0', 16)
    let projHome = `${config.IO.PROJECT_BASE_DIR}/${code}`
    while (fs.existsSync(projHome)) {
      code = randomize('Aa0', 16)
      projHome = `${config.IO.PROJECT_BASE_DIR}/${code}`
    }

    const projName = data.project.name
    const projDesc = data.project.desc
    const projType = data.project.type

    fs.mkdirSync(projHome)
    // don't save project name/desc to conf file
    delete data.project
    // get params from confFile if use a conf file
    if (data.params) {
      const { confFile } = data.params
      if (confFile) {
        logger.debug(confFile)
        if (fs.existsSync(confFile)) {
          const rawdata = fs.readFileSync(confFile)
          const result = JSON.parse(rawdata)
          data.params = result.params
        } else {
          logger.error('add project: config file does not exist')
          return res.status(400).json({
            error: { conf: 'The config file you selected does not exist.' },
            message: 'Action failed',
            success: false,
          })
        }
      }
    }

    fs.writeFileSync(`${projHome}/conf.json`, JSON.stringify(data))

    // save uploaded file to project home
    if (req.files) {
      const { file } = req.files
      const mvTo = `${projHome}/${file.name}`
      file.mv(`${mvTo}`, err => {
        if (err) {
          throw new Error('Failed to save uploaded file')
        }
        logger.debug(`upload to: ${mvTo}`)
      })
    }

    const newProject = new Project({
      name: projName,
      desc: projDesc,
      type: projType,
      owner: req.user.email,
      code,
    })
    const project = await newProject.save()
    // launch local workflow monitor after new project created
    await localWorkflowMonitor()

    return res.send({
      project,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Add project failed: ${err}`)

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project
const getOne = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/projects get: ${req.params.code}`)
    // find the project owned by user or shared to user or public
    const project = await getProject(req.params.code, 'user', req.user)

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

// Update project
const updateOne = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/projects update: ${req.params.code}`)
    const query = {
      code: { $eq: req.params.code },
      status: { $ne: 'delete' },
      owner: { $eq: req.user.email },
    }
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
    logger.error(`Update project failed: ${err}`)

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project configuration file
const getConf = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/projects/${req.params.code}/conf`)
    const conf = await getProjectConf(req.params.code, 'user', req)

    return res.json({
      conf,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/auth-user/projects/${req.params.code}/conf failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project result
const getResult = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/projects/${req.params.code}/result`)
    const result = await getProjectResult(req.params.code, 'user', req)

    return res.json({
      result,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/auth-user/projects/${req.params.code}/result failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project runStats
const getRunStats = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/projects/${req.params.code}/runStats`)
    const runStats = await getProjectRunStats(req.params.code, 'user', req)

    return res.json({
      runStats,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/auth-user/projects/${req.params.code}/runStats failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Find all projects owned by user
const getOwn = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/projects: ${req.user.email}`)
    const projects = await Project.find({
      type: { $ne: 'sra2fastq' },
      status: { $ne: 'delete' },
      owner: { $eq: req.user.email },
    }).sort([['updated', -1]])

    return res.send({
      projects,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`List user projects failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Find all projects that user can access to
const getAll = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/projects/all: ${req.user.email}`)
    const projects = await Project.find({
      type: { $ne: 'sra2fastq' },
      status: { $ne: 'delete' },
      $or: [
        { owner: { $eq: req.user.email } },
        { sharedTo: req.user.email },
        { public: true },
      ],
    }).sort([['updated', -1]])

    return res.send({
      projects,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`List all projects failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Find all projects with status in ('in queue', 'running', 'submitted')
const getQueue = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/projects/queue: ${req.user.email}`)
    const projects = await Project.find(
      { status: { $in: ['in queue', 'running', 'processing', 'submitted'] } },
      { name: 1, owner: 1, type: 1, status: 1, created: 1, updated: 1 },
    ).sort([['created', 1]])
    return res.send({
      projects,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`List project queue failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get files
const getFiles = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/projects/files ${JSON.stringify(req.body)}`)
    const projDir = config.IO.PROJECT_BASE_DIR
    let projStatuses = ['complete']
    if (req.body.projectStatuses) {
      projStatuses = req.body.projectStatuses
    }
    let query = {
      status: { $in: projStatuses },
      $or: [
        { owner: req.user.email },
        { sharedto: req.user.email },
        { public: true },
      ],
    }
    if (req.body.projectScope === 'self') {
      query = {
        status: { $in: projStatuses },
        $or: [{ owner: req.user.email }],
      }
    } else if (req.body.projectScope === 'self+shared') {
      query = {
        status: { $in: projStatuses },
        $or: [{ owner: req.user.email }, { sharedto: req.user.email }],
      }
    }
    if (req.body.projectTypes) {
      query.type = { $in: req.body.projectTypes }
    }
    if (req.body.projectCodes) {
      query.code = { $in: req.body.projectCodes }
    }

    const projects = await Project.find(query).sort([['name', -1]])
    let files = []
    let i = 0
    // make sure the FileBrowser key is unique
    for (i; i < projects.length; i += 1) {
      const proj = projects[i]
      let projName = `${proj.owner}/${proj.name}`
      // get project output dir
      let outdir = ''
      Object.keys(workflowList).forEach(key => {
        if (key === proj.type) {
          outdir = workflowList[key].outdir
        }
      })

      if (proj.type === 'sra2fastq') {
        projName += ` (${moment(proj.created).format('YYYY-MM-DD, h:mm:ss A')})`
        files = getAllFiles(
          `${projDir}/${proj.code}/${outdir}`,
          files,
          req.body.fileTypes,
          `sradata/${projName}`,
          `/sradata/${proj.code}/${outdir}`,
          `${projDir}/${proj.code}/${outdir}`,
          req.body.endsWith,
        )
      } else {
        projName += ` (${proj.type}, ${moment(proj.created).format('YYYY-MM-DD, h:mm:ss A')})`
        files = getAllFiles(
          `${projDir}/${proj.code}/${outdir}`,
          files,
          req.body.fileTypes,
          `projects/${projName}`,
          `/projects/${proj.code}/${outdir}`,
          `${projDir}/${proj.code}/${outdir}`,
          req.body.endsWith,
        )
      }
    }

    return res.json({
      fileData: files,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`/api/auth-user/projects/files failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get project output files
const getOutputs = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/projects/${req.params.code}/outputs`)
    const files = await getProjectOutputs(req.params.code, 'user', req)

    return res.json({
      fileData: files,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/auth-user/projects/${req.params.code}/outputs failed: ${err}`,
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
    logger.debug(`/api/auth-user/projects/${req.params.code}/batch/outputs`)
    const files = await getProjectBatchOutputs(req.params.code, 'user', req)

    return res.json({
      fileData: files,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(
      `/api/auth-user/projects/${req.params.code}/batch/outputs failed: ${err}`,
    )
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Find all projects owned by user with type
const getProjectsByType = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/projects/type: ${req.params.type}`)
    const projects = await Project.find({
      status: { $ne: 'delete' },
      type: { $eq: req.params.type },
      owner: { $eq: req.user.email },
    }).sort([['updated', -1]])

    return res.send({
      projects,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`List user projects failed: ${err}`)
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
  getAll,
  getQueue,
  getFiles,
  getOutputs,
  getBatchOutputs,
  getResult,
  getRunStats,
  getProjectsByType,
}
