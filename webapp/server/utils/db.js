const mongoose = require('mongoose')
const logger = require('./logger')
const config = require('../config')

// All timings can be overridden with environment variables for testing and
// tuning without a code change.
const envMs = (name, fallback) => Number(process.env[name]) || fallback

// The driver waits this long for a reachable server before failing an
// operation. Kept below Mongoose's 10s command buffering timeout so callers see
// the real connection error instead of a generic "buffering timed out" error.
const SERVER_SELECTION_TIMEOUT_MS = envMs(
  'DB_SERVER_SELECTION_TIMEOUT_MS',
  8000,
)
// Initial connection retry policy (exponential backoff, capped).
const CONNECT_MAX_ATTEMPTS = envMs('DB_CONNECT_MAX_ATTEMPTS', 10)
const CONNECT_RETRY_BASE_MS = envMs('DB_CONNECT_RETRY_BASE_MS', 2000)
const CONNECT_RETRY_MAX_MS = envMs('DB_CONNECT_RETRY_MAX_MS', 30000)
// How long the process may stay disconnected before it exits, so that the
// process manager (PM2) restarts it with a fresh connection. Mongoose does not
// re-establish a connection whose initial handshake never succeeded, which
// leaves the process alive but permanently unable to run any query.
const DISCONNECT_GRACE_MS = envMs('DB_DISCONNECT_GRACE_MS', 120000)

const sleep = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

const dbUri = () =>
  `mongodb://${config.DATABASE.SERVER_HOST}:${config.DATABASE.SERVER_PORT}/${config.DATABASE.NAME}`

const dbOptions = () => {
  const options = { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS }
  // Only send credentials when they are configured. Sending empty credentials
  // to a server that has authorization disabled makes every connection attempt
  // fail authentication.
  if (config.DATABASE.USERNAME && config.DATABASE.PASSWORD) {
    options.authSource = 'admin'
    options.user = config.DATABASE.USERNAME
    options.pass = config.DATABASE.PASSWORD
  }
  return options
}

// readyState 1 means connected
const isDbConnected = () => mongoose.connection.readyState === 1

let disconnectTimer = null
let shuttingDown = false
let everConnected = false

const clearDisconnectTimer = () => {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer)
    disconnectTimer = null
  }
}

const startDisconnectTimer = label => {
  if (disconnectTimer) {
    return
  }
  disconnectTimer = setTimeout(() => {
    logger.error(
      `${label}: database unreachable for ${
        DISCONNECT_GRACE_MS / 1000
      }s, exiting so the process manager can restart this process`,
    )
    process.exit(1)
  }, DISCONNECT_GRACE_MS)
  // the watchdog alone must not keep the event loop alive
  if (disconnectTimer.unref) {
    disconnectTimer.unref()
  }
}

const watchConnection = label => {
  const { connection } = mongoose
  connection.on('connected', () => {
    everConnected = true
    clearDisconnectTimer()
    logger.info(`${label}: database connection established`)
  })
  connection.on('reconnected', () => {
    clearDisconnectTimer()
    logger.info(`${label}: database connection re-established`)
  })
  connection.on('disconnected', () => {
    if (shuttingDown) {
      logger.info(`${label}: database connection closed`)
      return
    }
    if (!everConnected) {
      // still inside the initial connect retry loop, which does its own logging
      logger.debug(`${label}: database not reachable yet`)
      return
    }
    logger.error(`${label}: database connection lost`)
    startDisconnectTimer(label)
  })
  connection.on('error', err => {
    if (!everConnected) {
      logger.debug(`${label}: database connection error: ${err.message}`)
      return
    }
    logger.error(`${label}: database connection error: ${err.message}`)
  })
}

/**
 * Connects to MongoDB and keeps watching the connection.
 *
 * Rejects when the database is still unreachable after CONNECT_MAX_ATTEMPTS, so
 * the caller can exit instead of starting up with a dead connection that only
 * produces buffering timeouts.
 *
 * @param {string} label name used in log messages, e.g. 'cronserver'
 */
const connectDB = async (label = 'server') => {
  const uri = dbUri()
  mongoose.set('strictQuery', false)
  watchConnection(label)

  for (let attempt = 1; attempt <= CONNECT_MAX_ATTEMPTS; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await mongoose.connect(uri, dbOptions())
      logger.info(`${label}: Successfully connected to database ${uri}`)
      return
    } catch (err) {
      logger.error(
        `${label}: database connection attempt ${attempt}/${CONNECT_MAX_ATTEMPTS} to ${uri} failed: ${err.message}`,
      )
      if (attempt === CONNECT_MAX_ATTEMPTS) {
        throw err
      }
      const delay = Math.min(
        CONNECT_RETRY_BASE_MS * 2 ** (attempt - 1),
        CONNECT_RETRY_MAX_MS,
      )
      // eslint-disable-next-line no-await-in-loop
      await sleep(delay)
    }
  }
}

/**
 * Wraps a scheduled task so it is skipped while the database is disconnected.
 * Without this guard every monitor logs a 10s buffering timeout on every tick,
 * which produces thousands of identical error lines per day.
 *
 * @param {string} name task name used in log messages
 * @param {Function} task async task to run
 * @returns {Function} guarded task
 */
const whenDbReady = (name, task) => async () => {
  if (!isDbConnected()) {
    logger.debug(`${name} skipped: database not connected`)
    return
  }
  try {
    await task()
  } catch (err) {
    logger.error(`${name} failed: ${err.message}`)
  }
}

/**
 * Closes the connection without tripping the disconnect watchdog. Use this on
 * shutdown signals so a deliberate stop is not reported as an outage.
 */
const closeDB = async () => {
  shuttingDown = true
  clearDisconnectTimer()
  await mongoose.connection.close()
}

module.exports = { connectDB, closeDB, isDbConnected, whenDbReady }
