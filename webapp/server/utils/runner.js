const fs = require('fs')
const { randomUUID } = require('crypto')
const { workflowList, generateRunnerInput } = require('../workflow/util')
const { getRunnerClient } = require('./jobRunnerClient')
const config = require('../config')

/**
 * Marks an error as unrecoverable and rethrows it.
 *
 * Failures raised while assembling a submission (unknown workflow, missing
 * entrypoint) are deterministic, so they must not be retried.
 *
 * @param error {Error} The error to mark
 * @throws {Error} Always
 */
const throwPermanent = error => {
  error.runnerPermanent = true
  throw error
}

/**
 * Generates a unique job handle for a project.
 *
 * The handle doubles as the idempotency key and, for nextflow, as the run name.
 * It must be unique per submission — reusing a handle across reruns would make
 * the runner return the previous (already terminal) job, and would collide in
 * nextflow's run cache.
 *
 * @param proj {object} The project document
 * @return {string} The job handle
 */
const generateJobId = proj => `edge-${proj.code}-${randomUUID()}`

/**
 * Returns `true` when a workflow is a nextflow workflow.
 *
 * Keyed on the entrypoint, not on `runner`, so the answer does not change with
 * NEXTFLOW_MODE.
 *
 * @param projectType {string} The project/workflow type
 * @return {boolean}
 */
const isNextflowWorkflow = projectType => {
  const workflow = workflowList[projectType]
  return Boolean(workflow && workflow.nextflow_main)
}

/**
 * Resolves which job runner executes a project type.
 *
 * Nextflow workflows resolve to NEXTFLOW_RUNNER_NAME so they do not have to
 * declare a runner: the deployed service is often registered under a different
 * name (e.g. 'edgev3_nextflow'). Other tools name their runner explicitly.
 *
 * @param projectType {string} The project/workflow type
 * @return {string} The runner name
 * @throws {Error} When no runner can be resolved
 */
const getRunnerName = projectType => {
  if (isNextflowWorkflow(projectType)) {
    return config.NEXTFLOW.RUNNER_NAME
  }
  const workflow = workflowList[projectType]
  const runner = workflow && workflow.runner
  if (!runner) {
    throwPermanent(new Error(`No job runner configured for '${projectType}'`))
  }
  return runner
}

/**
 * Returns `true` when a runner name refers to the nextflow runner.
 *
 * @param runner {string} The runner name
 * @return {boolean}
 */
const isNextflowRunner = runner =>
  runner === 'nextflow' || runner === config.NEXTFLOW.RUNNER_NAME

/**
 * Returns `true` when a project type can be submitted to a job runner.
 *
 * Nextflow workflows qualify only when NEXTFLOW_MODE=runner; in direct mode
 * they are executed by the web server instead.
 *
 * @param projectType {string} The project/workflow type
 * @return {boolean}
 */
const hasRunner = projectType => {
  if (isNextflowWorkflow(projectType)) {
    return config.NEXTFLOW.MODE === 'runner'
  }
  return Boolean(workflowList[projectType] && workflowList[projectType].runner)
}

/**
 * Creates a directory and relaxes its permissions.
 *
 * The job runner usually executes as a different uid than the web server, so
 * directories the runner must write into cannot rely on the server's umask.
 *
 * @param dir {string} The directory to create
 */
const makeSharedDir = dir => {
  fs.mkdirSync(dir, { recursive: true })
  fs.chmodSync(dir, '777')
}

/**
 * Builds the `input` object for a nextflow submission.
 *
 * The runner receives paths and flags rather than a command line; it is
 * responsible for assembling the actual `nextflow run` invocation, including
 * any ssh hop to a scheduler login node. `executor` is forwarded so the runner
 * knows whether to run locally or submit to slurm.
 *
 * The work directory is emitted under both `workDir` and `workPath` because
 * deployed runners disagree on the name. Runners ignore payload keys they do
 * not consume, so sending both keeps one upstream compatible with both.
 *
 * @param proj {object} The project document
 * @param projectConf {object} The parsed project conf.json
 * @param jobId {string} The job handle, reused as the nextflow run name
 * @return {object} The submission input
 */
const buildNextflowInput = (proj, projectConf, jobId) => {
  const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
  const workflow = workflowList[projectConf.workflow.name]
  if (!workflow.nextflow_main) {
    throwPermanent(
      new Error(`No nextflow entrypoint configured for '${proj.type}'`),
    )
  }
  const nfOutDir = `${projHome}/nextflow`
  const nfWorkDir = config.NEXTFLOW.WORK_DIR
    ? `${config.NEXTFLOW.WORK_DIR}/${proj.code}/work`
    : `${nfOutDir}/work`
  makeSharedDir(nfWorkDir)
  makeSharedDir(nfOutDir)

  const input = {
    workflowPath: workflow.nextflow_main,
    // Same value under both names; see the note above.
    workDir: nfWorkDir,
    workPath: nfWorkDir,
    outputPath: `${projHome}/${workflow.outdir}`,
    nextflowLogPath: `${nfOutDir}/.nextflow.log`,
    logPath: `${nfOutDir}/job-runner.log`,
    donePath: `${nfOutDir}/.job-runner.done`,
    runName: jobId,
    executor: config.NEXTFLOW.EXECUTOR,
  }
  // Workflows that template a nextflow.config get it passed with -C. Those that
  // rely entirely on profiles/params do not have one.
  if (workflow.config_tmpl) {
    input.configPath = `${projHome}/nextflow.config`
  }
  if (workflow.nextflow_profile) {
    input.profile = workflow.nextflow_profile
  }
  if (workflow.nextflow_params_file) {
    input.paramsPath = workflow.nextflow_params_file
  }
  input.resume = workflow.nextflow_resume === true
  return input
}

/**
 * Builds a complete job-runner submission for a project.
 *
 * Nextflow submissions are built here because the nextflow contract is part of
 * the core. Every other runner delegates to `generateRunnerInput` in
 * workflow/util.js, which is the app-specific layer — that keeps tool-specific
 * knowledge (BioAI, SPAdes, ...) out of the core.
 *
 * @param proj {object} The project document
 * @param jobId {string} The job handle
 * @return {{runner: string, body: object}} The runner name and request body
 */
const buildSubmission = (proj, jobId) => {
  const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
  let projectConf
  try {
    projectConf = JSON.parse(fs.readFileSync(`${projHome}/conf.json`))
  } catch (error) {
    throwPermanent(new Error(`Unable to read conf.json: ${error.message}`))
  }
  const workflow = workflowList[projectConf.workflow.name]
  if (!workflow) {
    throwPermanent(new Error(`Unknown workflow '${projectConf.workflow.name}'`))
  }
  const runner = getRunnerName(proj.type)

  let input
  if (isNextflowWorkflow(projectConf.workflow.name)) {
    input = buildNextflowInput(proj, projectConf, jobId)
  } else {
    // Declaring the nextflow runner without an entrypoint is a configuration
    // error: the nextflow runner cannot execute a tool-style submission.
    if (isNextflowRunner(runner)) {
      throwPermanent(
        new Error(
          `Workflow '${projectConf.workflow.name}' targets the nextflow runner but declares no nextflow_main`,
        ),
      )
    }
    if (typeof generateRunnerInput !== 'function') {
      throwPermanent(
        new Error(
          `workflow/util.js must export generateRunnerInput to support runner '${runner}'`,
        ),
      )
    }
    const outputPath = `${projHome}/${workflow.outdir}`
    makeSharedDir(outputPath)
    input = {
      outputPath,
      logPath: `${projHome}/log.txt`,
      donePath: `${projHome}/.done`,
      ...generateRunnerInput(proj, projectConf, jobId),
    }
  }

  return { runner, body: { jobId, projectId: proj.code, input } }
}

/**
 * Submits a project to its job runner.
 *
 * @param proj {object} The project document
 * @param jobId {string} The job handle
 * @return {Promise<object>} The runner's job representation, plus `runner`
 */
const submitRunnerJob = async (proj, jobId) => {
  const { runner, body } = buildSubmission(proj, jobId)
  const runnerJob = await getRunnerClient(runner).submit(body)
  return { ...runnerJob, runner }
}

/**
 * Polls a job's state.
 *
 * @param job {object} The job document
 * @return {Promise<object>} The runner's job representation
 */
const getRunnerJob = async job => getRunnerClient(job.runner).get(job.id)

/**
 * Requests cancellation of a job.
 *
 * @param job {object} The job document
 * @return {Promise<object>} The runner's job representation
 */
const cancelRunnerJob = async job => getRunnerClient(job.runner).cancel(job.id)

module.exports = {
  buildSubmission,
  cancelRunnerJob,
  generateJobId,
  getRunnerJob,
  getRunnerName,
  hasRunner,
  isNextflowRunner,
  isNextflowWorkflow,
  makeSharedDir,
  submitRunnerJob,
}
