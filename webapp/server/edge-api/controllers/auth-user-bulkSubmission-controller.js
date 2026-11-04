const randomize = require('randomatic')
const fs = require('fs')
const BulkSubmission = require('../models/bulkSubmission')
const logger = require('../../utils/logger')
const config = require('../../config')
const { mvAsync } = require('../../utils/common')

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

module.exports = {
  addOne,
  getOwn,
}
