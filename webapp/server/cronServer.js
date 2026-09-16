const express = require('express')
require('dotenv').config()
const cors = require('cors')
const cron = require('node-cron')
const logger = require('./utils/logger')
const { connectDB, closeDB, isDbConnected, whenDbReady } = require('./utils/db')
const { fileUploadMonitor } = require('./crons/uploadMonitor')
const {
  localWorkflowMonitor,
  localJobMonitor,
} = require('./crons/localMonitors')
const {
  cromwellJobMonitor,
  cromwellWorkflowMonitor,
} = require('./crons/cromwellMonitors')
const {
  nextflowJobMonitor,
  nextflowWorkflowMonitor,
} = require('./crons/nextflowMonitors')
const {
  projectDeletionMonitor,
  projectStatusMonitor,
  projectRerunMonitor,
} = require('./crons/projectMonitors')
const {
  bulkSubmissionMonitor,
  bulkSubmissionRerunMonitor,
} = require('./crons/bulkSubmissionMonitor')
const { dbBackup, dbBackupClean } = require('./crons/dbMonitors')
const { cleanupTempFiles } = require('./crons/fileMonitors')
const config = require('./config')

const app = express()
app.use(express.json())

// allow cross-origin requests
app.use(cors())

// Health check endpoint
app.get('/health', (req, res) => {
  const healthCheck = {
    status: isDbConnected() ? 'UP' : 'DOWN',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: isDbConnected() ? 'UP' : 'DOWN',
    },
  }
  res.status(isDbConnected() ? 200 : 503).json(healthCheck)
})

// cron jobs
// database backed monitors are skipped while the database is disconnected
// monitor local workflow on every 2 minutes
cron.schedule(
  config.CRON.SCHEDULES.LOCAL_WORKFLOW_MONITOR,
  whenDbReady('localWorkflowMonitor', localWorkflowMonitor),
)
// monitor local job on every 2 minutes
cron.schedule(
  config.CRON.SCHEDULES.LOCAL_JOB_MONITOR,
  whenDbReady('localJobMonitor', localJobMonitor),
)
// monitor cromwell jobs on every 2 minutes
cron.schedule(
  config.CRON.SCHEDULES.CROMWELL_JOB_MONITOR,
  whenDbReady('cromwellJobMonitor', cromwellJobMonitor),
)
// monitor workflow requests on every 2 minutes
cron.schedule(
  config.CRON.SCHEDULES.CROMWELL_WORKFLOW_MONITOR,
  whenDbReady('cromwellWorkflowMonitor', cromwellWorkflowMonitor),
)
// monitor nextflow jobs on every 2 minutes
cron.schedule(
  config.CRON.SCHEDULES.NEXTFLOW_JOB_MONITOR,
  whenDbReady('nextflowJobMonitor', nextflowJobMonitor),
)
// cron jobs
// monitor workflow requests on every 2 minutes
cron.schedule(
  config.CRON.SCHEDULES.NEXTFLOW_WORKFLOW_MONITOR,
  whenDbReady('nextflowWorkflowMonitor', nextflowWorkflowMonitor),
)
// monitor uploads every day at midnight
cron.schedule(
  config.CRON.SCHEDULES.FILE_UPLOAD_MONITOR,
  whenDbReady('fileUploadMonitor', fileUploadMonitor),
)
// monitor project status on every 1 minute
cron.schedule(
  config.CRON.SCHEDULES.PROJECT_STATUS_MONITOR,
  whenDbReady('projectStatusMonitor', projectStatusMonitor),
)
// monitor project rerun on every 1 minute
cron.schedule(
  config.CRON.SCHEDULES.PROJECT_RERUN_MONITOR,
  whenDbReady('projectRerunMonitor', projectRerunMonitor),
)
// monitor project deletion every day at 10pm
cron.schedule(
  config.CRON.SCHEDULES.PROJECT_DELETION_MONITOR,
  whenDbReady('projectDeletionMonitor', projectDeletionMonitor),
)
// monitor bulk submission requests on every 3 minutes
cron.schedule(
  config.CRON.SCHEDULES.BULKSUBMISSION_MONITOR,
  whenDbReady('bulkSubmissionMonitor', bulkSubmissionMonitor),
)
// monitor bulk submission rerun on every 1 minute
cron.schedule(
  config.CRON.SCHEDULES.BULKSUBMISSION_RERUN_MONITOR,
  whenDbReady('bulkSubmissionRerunMonitor', bulkSubmissionRerunMonitor),
)
// backup nmdcedge DB every day at 10pm
cron.schedule(config.CRON.SCHEDULES.DATABASE_BACKUP_CREATOR, () => {
  dbBackup()
})
// delete older DB backups every day at 12am
cron.schedule(config.CRON.SCHEDULES.DATABASE_BACKUP_PRUNER, () => {
  dbBackupClean()
})
// delete older temp files every hour
cron.schedule(config.CRON.SCHEDULES.TEMP_FILE_CLEANUP, () => {
  cleanupTempFiles()
})

const runApp = async () => {
  try {
    // Connect to MongoDB before serving anything
    await connectDB('cronserver')
  } catch (err) {
    logger.error(
      `cronserver: could not connect to the database, exiting: ${err.message}`,
    )
    process.exit(1)
  }
  // start server
  app.listen(config.CRON.SERVER_PORT, () =>
    logger.info(
      `HTTP CRON server up and running on port ${config.CRON.SERVER_PORT} !`,
    ),
  )
}

process.on('unhandledRejection', err => {
  logger.error(`cronserver: unhandled rejection: ${err && err.message}`)
})

process.on('SIGTERM', async () => {
  logger.info('cronserver: SIGTERM received, closing database connection')
  await closeDB()
  process.exit(0)
})

runApp()
