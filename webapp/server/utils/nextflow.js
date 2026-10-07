/**
 * Nextflow facade.
 *
 * Dispatches to one of two execution backends based on NEXTFLOW_MODE:
 *   direct - the web server runs the nextflow CLI itself (default, legacy)
 *   runner - the workflow is submitted to a job-runner HTTP service
 *
 * The exported API is identical in both modes, so callers (crons, controllers)
 * do not branch on the mode. Individual jobs are dispatched on their own
 * `queue` value rather than on the current config, so jobs submitted before a
 * mode change continue to be reconciled by the backend that created them.
 */

const fs = require('fs')
const ejs = require('ejs')
const Papa = require('papaparse')
const {
  nextflowConfigs,
  workflowList,
  generateNextflowWorkflowParams,
} = require('../workflow/util')
const direct = require('./nextflowDirect')
const runner = require('./nextflowRunner')
const config = require('../config')

/**
 * Returns `true` when a job was created by the direct backend.
 *
 * Direct jobs use queue 'nextflow'; runner-backed jobs use queue 'runner'.
 *
 * @param job {object} The job document
 * @return {boolean}
 */
const isDirectJob = job => job.queue === 'nextflow'

/**
 * Renders the project's nextflow.config from the workflow template.
 *
 * Required by both backends: in direct mode it is passed with -C, in runner
 * mode its path is sent as input.configPath.
 *
 * @param projHome {string} The project directory
 * @param projectConf {object} The parsed project conf.json
 * @param proj {object} The project document
 * @return {Promise<boolean>} `true` when a config was written, `false` when the
 *   workflow does not use one
 */
const generateInputs = async (projHome, projectConf, proj) => {
  const workflowSettings = workflowList[projectConf.workflow.name]
  // Workflows driven entirely by profiles/params have no config template.
  if (!workflowSettings.config_tmpl) return false
  const template = String(fs.readFileSync(workflowSettings.config_tmpl))
  const nfWorkDir = config.NEXTFLOW.WORK_DIR
    ? `${config.NEXTFLOW.WORK_DIR}/${proj.code}/work`
    : `${projHome}/nextflow/work`

  const params = {
    ...projectConf.workflow.input,
    ...projectConf.rawReads,
    project: proj.name,
    projOutdir: `${projHome}/${workflowSettings.outdir}`,
    nextflowWorkDir: nfWorkDir,
    nextflowOutDir: `${projHome}/nextflow`,
    workflow: projectConf.workflow.name,
    profiles: nextflowConfigs.profiles,
    nfReports: nextflowConfigs.nf_reports,
  }
  // get workflow specific params
  const workflowParams = await generateNextflowWorkflowParams(
    projHome,
    projectConf,
    proj,
  )
  // render input template and write to nextflow.config
  const inputs = ejs.render(template, { ...params, ...workflowParams })
  await fs.promises.writeFile(`${projHome}/nextflow.config`, inputs)
  return true
}

/**
 * Parses nextflow's trace file into rows.
 *
 * @param proj {object} The project document
 * @return {Promise<object[]>} The trace rows, empty when no trace exists
 */
const getJobMetadata = async proj => {
  const traceFile = `${config.IO.PROJECT_BASE_DIR}/${proj.code}/nextflow/trace.txt`
  if (!fs.existsSync(traceFile)) {
    return []
  }
  // get job metadata in trace.txt, convert tab delimiter file to json
  const jobMetadata = Papa.parse(fs.readFileSync(traceFile).toString(), {
    delimiter: '\t',
    header: true,
    skipEmptyLines: true,
  }).data
  return jobMetadata
}

const generateRunStats = async project => {
  const stats = await getJobMetadata(project)
  fs.writeFileSync(
    `${config.IO.PROJECT_BASE_DIR}/${project.code}/run_stats.json`,
    JSON.stringify({ stats }),
  )
}

/**
 * Submits a workflow using the configured backend.
 *
 * @param proj {object} The project document
 * @param projectConf {object} The parsed project conf.json
 * @param inputsize {number} Total input size in bytes
 * @return {Promise<void>}
 */
const submitWorkflow = async (proj, projectConf, inputsize) => {
  if (config.NEXTFLOW.MODE === 'runner') {
    return runner.submitWorkflow(proj, projectConf, inputsize)
  }
  return direct.submitWorkflow(proj, projectConf, inputsize)
}

/**
 * Reconciles a job using the backend that created it.
 *
 * @param job {object} The job document
 * @param proj {object} The project document
 * @return {Promise<void>}
 */
const updateJobStatus = async (job, proj) => {
  if (isDirectJob(job)) {
    return direct.updateJobStatus(job, proj)
  }
  return runner.updateJobStatus(job, proj, getJobMetadata)
}

/**
 * Aborts a job using the backend that created it.
 *
 * @param proj {object} The project document, or `{ code }` for an orphan
 * @param existingJob {object} [existingJob] The job document
 * @return {Promise<void>}
 */
const abortJob = async (proj, existingJob) => {
  // Without a job document, fall back to the configured mode.
  if (!existingJob) {
    return config.NEXTFLOW.MODE === 'runner'
      ? runner.abortJob(proj)
      : direct.abortJob(proj)
  }
  if (isDirectJob(existingJob)) {
    return direct.abortJob(proj)
  }
  return runner.abortJob(proj, existingJob)
}

module.exports = {
  generateInputs,
  submitWorkflow,
  generateRunStats,
  abortJob,
  getJobMetadata,
  updateJobStatus,
}
