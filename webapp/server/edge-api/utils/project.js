const fs = require('fs')
const randomize = require('randomatic')
const Project = require('../models/project')
const Job = require('../models/job')
const { getAllFiles, getTreeFiles, zipFiles } = require('../../utils/common')
const { generateRunStats } = require('../../utils/local')
const {
  generateRunStats: generateCromwellRunStats,
} = require('../../utils/cromwell')
const {
  generateRunStats: generateNextflowRunStats,
} = require('../../utils/nextflow')
const { generateWorkflowResult } = require('../../workflow/util')
const config = require('../../config')

const getProject = async (code, type, user) => {
  try {
    // Use $eq to prevent query selector injections
    const project = await Project.findOne({
      status: { $ne: 'delete' },
      code: { $eq: code },
    })
    if (project === null) {
      return null
    }
    if (type === 'admin') {
      return project
    }
    if (
      type === 'user' &&
      (project.owner === user.email ||
        project.sharedTo.includes(user.email) ||
        project.public)
    ) {
      return project
    }
    if (type === 'public' && project.public) {
      return project
    }
    return null
  } catch (err) {
    return Promise.reject(err)
  }
}

const updateProject = async (query, req) => {
  try {
    const proj = await Project.findOne(query)
    if (!proj) {
      return null
    }
    if (req.body.name) {
      proj.name = req.body.name
    }
    if (req.body.desc) {
      proj.desc = req.body.desc
    }
    if (req.body.status) {
      proj.status = req.body.status
    }
    if ('public' in req.body) {
      proj.public = req.body.public
    }
    if (req.body.sharedTo) {
      proj.sharedTo = req.body.sharedTo
    }
    if (req.body.jobPriority) {
      proj.jobPriority = req.body.jobPriority
    }

    const project = await proj.save()
    return project
  } catch (err) {
    return Promise.reject(err)
  }
}

// Return conf.json as JSON object
const getProjectConf = async (code, type, req) => {
  try {
    const proj = await getProject(code, type, req.user)
    let confJson = {}
    if (proj) {
      const projHome = `${config.IO.PROJECT_BASE_DIR}/${code}`
      confJson = JSON.parse(fs.readFileSync(`${projHome}/conf.json`))
    }
    return confJson
  } catch (err) {
    return Promise.reject(err)
  }
}

const getProjectOutputs = async (code, type, req) => {
  try {
    const projDir = config.IO.PROJECT_BASE_DIR
    const proj = await getProject(code, type, req.user)
    let files = []
    if (proj && fs.existsSync(`${projDir}/${proj.code}/output`)) {
      files = getAllFiles(
        `${projDir}/${proj.code}/output`,
        files,
        req.body.fileTypes,
        '',
        `/projects/${proj.code}/output`,
        `${projDir}/${proj.code}/output`,
      )
    }
    return files
  } catch (err) {
    return Promise.reject(err)
  }
}
// Return output files in tree data structure for file browser
const getProjectOutputTreeData = async (code, type, req) => {
  try {
    const projDir = config.IO.PROJECT_BASE_DIR
    const proj = await getProject(code, type, req.user)
    let files = []
    if (proj && fs.existsSync(`${projDir}/${proj.code}/output`)) {
      files = getTreeFiles(
        `${projDir}/${proj.code}/output`,
        '',
        `/projects/${proj.code}/output`,
        `${projDir}/${proj.code}/output`,
      )
    }
    return files
  } catch (err) {
    return Promise.reject(err)
  }
}

const getProjectResult = async (code, type, req) => {
  try {
    const proj = await getProject(code, type, req.user)
    let result = {}
    if (proj) {
      const projHome = `${config.IO.PROJECT_BASE_DIR}/${code}`
      const resultJson = `${projHome}/result.json`

      if (!fs.existsSync(resultJson)) {
        generateWorkflowResult(proj)
      }
      result = JSON.parse(fs.readFileSync(resultJson))
    }
    return result
  } catch (err) {
    return Promise.reject(err)
  }
}

const getProjectRunStats = async (code, type, req) => {
  try {
    const proj = await getProject(code, type, req.user)
    let stats = {}
    if (proj) {
      // get associated job
      const job = await Job.findOne({ project: { $eq: code } })
      if (!job) {
        return {}
      }
      const projHome = `${config.IO.PROJECT_BASE_DIR}/${code}`
      const statsJson = `${projHome}/run_stats.json`
      if (job.queue === 'nextflow') {
        await generateNextflowRunStats(proj)
      } else if (job.queue === 'cromwell') {
        generateCromwellRunStats(proj)
      } else {
        await generateRunStats(proj)
      }
      stats = JSON.parse(fs.readFileSync(statsJson))
    }
    return stats
  } catch (err) {
    return Promise.reject(err)
  }
}
// zip output files and return the zip file url
const zipProjectOutputs = async (code, type, req) => {
  try {
    const proj = await getProject(code, type, req.user)
    if (!proj) {
      throw new Error('Project not found')
    }
    // generate tmp code and create tmp dir for zip file
    let tmp = randomize('Aa0', 8)
    let outDir = `${config.IO.TMP_BASE_DIR}/${tmp}`
    while (fs.existsSync(outDir)) {
      tmp = randomize('Aa0', 8)
      outDir = `${config.IO.TMP_BASE_DIR}/${tmp}`
    }
    fs.mkdirSync(outDir)

    const zipName = `${proj.name.replaceAll(' ', '_')}_${proj.type.replaceAll(' ', '_')}_${new Date().toISOString().split('.')[0].replace(/:/g, '-')}.tgz`
    await zipFiles(
      `${outDir}/${zipName}`,
      `${config.IO.PROJECT_BASE_DIR}/${proj.code}/output`,
      req.body.filePaths,
    )
    // relative url to download the zip file
    return `/${tmp}/${zipName}`
  } catch (err) {
    return Promise.reject(err)
  }
}

module.exports = {
  getAllFiles,
  getProject,
  updateProject,
  getProjectConf,
  getProjectOutputs,
  getProjectOutputTreeData,
  getProjectResult,
  getProjectRunStats,
  zipProjectOutputs,
}
