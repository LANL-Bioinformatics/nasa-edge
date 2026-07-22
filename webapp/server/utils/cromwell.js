const fs = require('fs')
const dayjs = require('dayjs')
const duration = require('dayjs/plugin/duration')
// Activate the plugin
dayjs.extend(duration)
const FormData = require('form-data')
const ejs = require('ejs')
const Job = require('../edge-api/models/job')
const { workflowList, generateWorkflowResult } = require('../workflow/util')
const { write2log, postData, getData, timeFormat } = require('./common')
const logger = require('./logger')
const config = require('../config')

const generateWDL = async (projHome, projectConf) => {
  // projectConf: project conf.js
  // workflowList in utils/workflow
  const wdl = `${config.CROMWELL.WDL_DIR}/${workflowList[projectConf.workflow.name].wdl}`
  if (fs.existsSync(wdl)) {
    // add pipeline.wdl link
    fs.symlinkSync(wdl, `${projHome}/pipeline.wdl`, 'file')
    return true
  }
  return false
}

const generateInputs = async (projHome, projectConf, workflowConf) => {
  // projectConf: project conf.js
  // workflowList in utils/workflow
  const workflowSettings = workflowList[projectConf.workflow.name]
  const template = String(
    fs.readFileSync(
      `${config.CROMWELL.TEMPLATE_DIR}/${workflowSettings.inputs_tmpl}`,
    ),
  )
  const params = {
    ...workflowConf,
    ...projectConf.workflow.input,
    outdir: `${projHome}/${workflowSettings.outdir}`,
  }

  if (projectConf.workflow.name === 'sra2fastq') {
    params.outdir = config.IO.SRA_BASE_DIR
  }

  // render input template and write to pipeline_inputs.json
  const inputs = ejs.render(template, params)
  await fs.promises.writeFile(`${projHome}/pipeline_inputs.json`, inputs)
  // render options template and write to pipeline_options.json
  if (
    fs.existsSync(
      `${config.CROMWELL.TEMPLATE_DIR}/${workflowSettings.options_tmpl}`,
    )
  ) {
    const optionsTemplate = String(
      fs.readFileSync(
        `${config.CROMWELL.TEMPLATE_DIR}/${workflowSettings.options_tmpl}`,
      ),
    )
    const options = ejs.render(optionsTemplate, params)
    await fs.promises.writeFile(`${projHome}/pipeline_options.json`, options)
  }
  return true
}

// submit workflow to cromwell through api
const submitWorkflow = (proj, projectConf, inputsize) => {
  const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
  const formData = new FormData()
  formData.append(
    'workflowSource',
    fs.createReadStream(`${projHome}/pipeline.wdl`),
  )
  // logger.debug(`workflowSource: ${projHome}/pipeline.wdl`);
  formData.append(
    'workflowInputs',
    fs.createReadStream(`${projHome}/pipeline_inputs.json`),
  )
  // logger.debug(`workflowInputs${projHome}/pipeline_inputs.json`);

  const imports = `${config.CROMWELL.WDL_DIR}/${workflowList[projectConf.workflow.name].wdl_imports}`
  const optionsJson = `${projHome}/pipeline_options.json`

  if (fs.existsSync(optionsJson)) {
    formData.append('workflowOptions', fs.createReadStream(optionsJson))
    logger.debug(`workflowOptions:${optionsJson}`)
  }

  formData.append('workflowType', config.CROMWELL.WORKFLOW_TYPE)
  let wdlVersion = workflowList[projectConf.workflow.name].wdl_version
  if (!wdlVersion) {
    wdlVersion = workflowList.default_wdl_version
    logger.debug(`wdlVersion:${wdlVersion}`)
  }
  formData.append('workflowTypeVersion', wdlVersion)
  formData.append('workflowDependencies', fs.createReadStream(imports), {
    contentType: 'application/zip',
  })
  logger.debug(`workflowDependencies: ${imports}`)

  const formHeaders = formData.getHeaders()
  const formBoundary = formData.getBoundary()

  postData(config.CROMWELL.API_BASE_URL, formData, {
    headers: {
      ...formHeaders,
      formBoundary,
    },
  })
    .then(response => {
      logger.debug(JSON.stringify(response))
      const newJob = new Job({
        id: response.id,
        project: proj.code,
        type: proj.type,
        inputsize,
        queue: 'cromwell',
        status: 'Submitted',
      })
      newJob.save().catch(err => {
        logger.error('falied to save to cromwelljob: ', err)
      })
      proj.status = 'submitted'
      proj.save()
    })
    .catch(error => {
      proj.status = 'failed'
      proj.save()
      let message = error
      if (error.data) {
        message = error.data.message
      }
      write2log(`${config.IO.PROJECT_BASE_DIR}/${proj.code}/log.txt`, message)
      logger.error(`Failed to submit workflow to Cromwell: ${message}`)
    })
}

const abortJob = job => {
  // abort job through api
  logger.debug(`POST: ${config.CROMWELL.API_BASE_URL}/${job.id}/abort`)
  postData(`${config.CROMWELL.API_BASE_URL}/${job.id}/abort`)
    .then(response => {
      logger.debug(response)
      // update job status
      job.status = 'Aborted'
      job.save()
      write2log(
        `${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`,
        'Cromwell job aborted.',
      )
    })
    .catch(error => {
      let message = error
      if (error.message) {
        message = error.message
      }
      write2log(`${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`, message)
      logger.error(message)
      // not cromwell api server error, job may already complete/fail
      if (error.status !== 500) {
        job.status = 'Aborted'
        job.save()
        write2log(
          `${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`,
          'Cromwell job aborted.',
        )
      }
    })
}

const getJobMetadata = job => {
  // get job metadata through api
  logger.debug(`GET: ${config.CROMWELL.API_BASE_URL}/${job.id}/metadata`)
  getData(`${config.CROMWELL.API_BASE_URL}/${job.id}/metadata`)
    .then(metadata => {
      // logger.debug(JSON.stringify(metadata));
      logger.debug(
        `${config.IO.PROJECT_BASE_DIR}/${job.project}/cromwell_job_metadata.json`,
      )
      fs.writeFileSync(
        `${config.IO.PROJECT_BASE_DIR}/${job.project}/cromwell_job_metadata.json`,
        JSON.stringify(metadata),
      )

      // dump error logs
      Object.keys(metadata.calls).forEach(callkey => {
        const subStatus = metadata.calls[callkey][0].executionStatus
        const subId = metadata.calls[callkey][0].subWorkflowId

        // get cromwell logs
        if (subStatus === 'Failed' && subId) {
          logger.debug(`GET: ${config.CROMWELL.API_BASE_URL}/${subId}/logs`)
          getData(`${config.CROMWELL.API_BASE_URL}/${subId}/logs`)
            .then(logs => {
              logger.debug(JSON.stringify(logs))
              fs.writeFileSync(
                `${config.IO.PROJECT_BASE_DIR}/${job.project}/${callkey}.cromwell_job_logs.json`,
                JSON.stringify(logs),
              )
              // dump stderr to log.txt
              Object.keys(logs.calls).forEach(call => {
                logger.debug(call)
                logs.calls[call].forEach(item => {
                  const { stderr } = item
                  logger.debug(stderr)
                  if (fs.existsSync(stderr)) {
                    const errs = fs.readFileSync(stderr)
                    write2log(
                      `${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`,
                      call,
                    )
                    write2log(
                      `${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`,
                      errs,
                    )
                  }
                })
              })
            })
            .catch(error => {
              logger.error(`Failed to get logs from Cromwell API: ${error}`)
            })
        }
      })
    })
    .catch(error => {
      logger.error(`Failed to get metadata from Cromwell API: ${error}`)
    })
}

const getWorkflowStats = (
  jobStats,
  cromwellCalls,
  workflow,
  workflowStats,
  stats,
) => {
  workflowStats.Status = ''
  workflowStats['Running Time'] = ''
  workflowStats.Start = ''
  workflowStats.End = ''
  let myStart = ''
  let myEnd = ''
  cromwellCalls.forEach(cromwellCall => {
    if (jobStats.calls[cromwellCall]) {
      if (!workflowStats.Status || workflowStats.Status !== 'Failed') {
        // set status to 'Failed' is one of the subjob is failed
        workflowStats.Status = jobStats.calls[cromwellCall][0].executionStatus
      }
      const { start } = jobStats.calls[cromwellCall][0]
      const { end } = jobStats.calls[cromwellCall][0]

      if (start && !workflowStats.Start) {
        workflowStats.Start = dayjs(start).format('YYYY-MM-DD HH:mm:ss')
        myStart = start
      }
      if (end) {
        workflowStats.End = dayjs(end).format('YYYY-MM-DD HH:mm:ss')
        myEnd = end
      }
    }
  })

  if (myStart && myEnd) {
    const ms = dayjs(myEnd).diff(dayjs(myStart))
    const d = dayjs.duration(ms)
    workflowStats['Running Time'] = timeFormat(d)
  }
  stats.push(workflowStats)
}

const generateRunStats = project => {
  const confFile = `${config.IO.PROJECT_BASE_DIR}/${project.code}/conf.json`
  const jobMetadataFile = `${config.IO.PROJECT_BASE_DIR}/${project.code}/cromwell_job_metadata.json`

  let rawdata = fs.readFileSync(confFile)
  const conf = JSON.parse(rawdata)

  const stats = []
  if (fs.existsSync(jobMetadataFile)) {
    rawdata = fs.readFileSync(jobMetadataFile)
    const jobStats = JSON.parse(rawdata)
    if (conf.workflow) {
      const workflowStats = {}
      const cromwellCalls = workflowList[conf.workflow.name].cromwell_calls
      workflowStats.Workflow = workflowList[conf.workflow.name].full_name
      workflowStats.Run = 'On'
      getWorkflowStats(
        jobStats,
        cromwellCalls,
        conf.workflow,
        workflowStats,
        stats,
      )
    }
  }

  fs.writeFileSync(
    `${config.IO.PROJECT_BASE_DIR}/${project.code}/run_stats.json`,
    JSON.stringify({ stats }),
  )
}

const updateJobStatus = (job, proj) => {
  // get job status through api
  logger.debug(`GET: ${config.CROMWELL.API_BASE_URL}/${job.id}/status`)
  getData(`${config.CROMWELL.API_BASE_URL}/${job.id}/status`)
    .then(response => {
      logger.debug(JSON.stringify(response))
      // update project status
      if (job.status !== response.status) {
        let status = null
        if (response.status === 'Running') {
          status = 'running'
        } else if (response.status === 'Succeeded') {
          // generate result.json
          logger.info('generate workflow result.json')
          try {
            generateWorkflowResult(proj)
          } catch (e) {
            job.status = response.status
            job.save()
            // result not as expected
            proj.status = 'failed'
            proj.save()
            throw e
          }
          status = 'complete'
        } else if (response.status === 'Failed') {
          status = 'failed'
        } else if (response.status === 'Aborted') {
          status = 'in queue'
        }
        proj.status = status
        proj.save()
        write2log(
          `${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`,
          `Cromwell job status: ${response.status}`,
        )
      }
      // update job even its status unchanged. We need set new updated time for this job.
      if (response.status === 'Aborted') {
        // delete job
        Job.deleteOne({ project: proj.code }, err => {
          if (err) {
            logger.error(`Failed to delete job from DB ${proj.code}:${err}`)
          }
        })
      } else {
        job.status = response.status
        job.save()
        getJobMetadata(job)
      }
    })
    .catch(error => {
      let message = error
      if (error.message) {
        message = error.message
      }
      write2log(`${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`, message)
      logger.error(message)
    })
}

module.exports = {
  generateWDL,
  generateInputs,
  submitWorkflow,
  generateRunStats,
  abortJob,
  getJobMetadata,
  updateJobStatus,
}
