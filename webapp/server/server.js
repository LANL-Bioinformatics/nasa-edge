require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const bodyParser = require('body-parser')
const fileUpload = require('express-fileupload')
const mongoose = require('mongoose')
const passport = require('passport')
const path = require('path')
const cron = require('node-cron')
const swaggerUi = require('swagger-ui-express')
const swaggerSpec = require('./edge-api/swagger/swaggerSpec')
const logger = require('./utils/logger')
const indexRouter = require('./indexRouter')
const indexWorkflowRouter = require('./workflow/indexRouter')
const { uploadMonitor } = require('./crons/uploadMonitor')
const {
  localWorkflowMonitor,
  localJobMonitor,
} = require('./crons/localMonitors')
const { cromwellWorkflowMonitor } = require('./crons/cromwellMonitors')
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
const config = require('./config')

const app = express()
app.use(cors({ origin: '*' }))
// Helmet helps to secure Express apps by setting various HTTP headers.
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
)
app.use(express.json())
app.use(
  fileUpload({
    limits: { fileSize: config.FILE_UPLOADS.MAX_FILE_SIZE_BYTES },
    abortOnLimit: true,
    debug: false,
    useTempFiles: true,
    tempFileDir: config.IO.UPLOADED_FILES_TEMP_DIR,
  }),
)
// Bodyparser middleware
app.use(
  bodyParser.urlencoded({
    extended: false,
  }),
)

app.use(bodyParser.json())

// Passport middleware
app.use(passport.initialize())
// Passport config
require('./edge-api/utils/passport')(passport)
// APIs
app.use('/api', indexRouter)
// workflow APIs
app.use('/api/workflow', indexWorkflowRouter)
// API docs
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, { explorer: false }),
)

// Serving static files in Express
app.use(
  '/projects',
  express.static(config.IO.PROJECT_BASE_DIR, { dotfiles: 'allow' }),
)
app.use(
  '/bulksubmissions',
  express.static(config.IO.BULKSUBMISSION_BASE_DIR, { dotfiles: 'allow' }),
)
app.use('/uploads', express.static(config.IO.UPLOADED_FILES_DIR))
app.use('/publicdata', express.static(config.IO.PUBLIC_BASE_DIR))
app.use('/workflow-docs', express.static(config.IO.WORKFLOW_DOCS_DIR))

// Serving React as static files in Express and redirect url path to React client app
if (config.NODE_ENV === 'production') {
  app.use(express.static(config.CLIENT.BUILD_DIR))
  app.get('*', (req, res) => {
    res.sendFile(path.join(config.CLIENT.BUILD_DIR, 'index.html'))
  })
} else {
  // cron jobs
  // monitor local workflow on every 2 minutes
  cron.schedule(config.CRON.SCHEDULES.LOCAL_WORKFLOW_MONITOR, async () => {
    await localWorkflowMonitor()
  })
  // monitor local job on every 2 minutes
  cron.schedule(config.CRON.SCHEDULES.LOCAL_JOB_MONITOR, async () => {
    await localJobMonitor()
  })
  // monitor workflow requests on every 2 minutes
  cron.schedule(config.CRON.SCHEDULES.CROMWELL_WORKFLOW_MONITOR, async () => {
    await cromwellWorkflowMonitor()
  })
  // monitor nextflow jobs on every 2 minutes
  cron.schedule(config.CRON.SCHEDULES.NEXTFLOW_JOB_MONITOR, async () => {
    await nextflowJobMonitor()
  })
  // monitor workflow requests on every 2 minutes
  cron.schedule(config.CRON.SCHEDULES.NEXTFLOW_WORKFLOW_MONITOR, async () => {
    await nextflowWorkflowMonitor()
  })
  // monitor uploads every day at midnight
  cron.schedule(config.CRON.SCHEDULES.FILE_UPLOAD_MONITOR, async () => {
    await uploadMonitor()
  })
  // monitor project status on every 1 minute
  cron.schedule(config.CRON.SCHEDULES.PROJECT_STATUS_MONITOR, async () => {
    await projectStatusMonitor()
  })
  // monitor project rerun on every 1 minute
  cron.schedule(config.CRON.SCHEDULES.PROJECT_RERUN_MONITOR, async () => {
    await projectRerunMonitor()
  })
  // monitor project deletion every day at 10pm
  cron.schedule(config.CRON.SCHEDULES.PROJECT_DELETION_MONITOR, async () => {
    await projectDeletionMonitor()
  })
  // monitor bulk submission requests on every 3 minutes
  cron.schedule(config.CRON.SCHEDULES.BULKSUBMISSION_MONITOR, async () => {
    await bulkSubmissionMonitor()
  })
  // monitor bulk submission rerun on every 1 minute
  cron.schedule(
    config.CRON.SCHEDULES.BULKSUBMISSION_RERUN_MONITOR,
    async () => {
      await bulkSubmissionRerunMonitor()
    },
  )
  // backup nmdcedge DB every day at 10pm
  cron.schedule(config.CRON.SCHEDULES.DATABASE_BACKUP_CREATOR, () => {
    dbBackup()
  })
  // delete older DB backups every day at 12am
  cron.schedule(config.CRON.SCHEDULES.DATABASE_BACKUP_PRUNER, () => {
    dbBackupClean()
  })
}

const runApp = async () => {
  try {
    // Connect to MongoDB
    const db = `mongodb://${config.DATABASE.SERVER_HOST}:${config.DATABASE.SERVER_PORT}/${config.DATABASE.NAME}`
    const dbOptions = {
      authSource: "admin",
      user: config.DATABASE.USERNAME,
      pass: config.DATABASE.PASSWORD,
    }
    mongoose.set('strictQuery', false)
    mongoose.connect(db, dbOptions)
    logger.info(`Successfully connected to database ${db}`)
    // start server
    app.listen(config.APP.SERVER_PORT, () =>
      logger.info(
        `HTTP ${config.NODE_ENV} server up and running on port ${config.APP.SERVER_PORT} !`,
      ),
    )
  } catch (err) {
    logger.error(err)
  }
}

runApp()
