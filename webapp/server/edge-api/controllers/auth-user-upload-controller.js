const randomize = require('randomatic')
const fs = require('fs')
const Upload = require('../models/upload')
const User = require('../models/user')
const {
  updateUpload,
  getUploadedSize,
  getUploadFolderOptions,
} = require('../utils/upload')
const logger = require('../../utils/logger')
const config = require('../../config')

const sysError = config.APP.API_ERROR

// Create a upload
const addOne = async (req, res) => {
  try {
    const data = req.body
    logger.debug(`/api/auth-user/uploads add: ${JSON.stringify(data)}`)

    // check storage size
    const size = await getUploadedSize(req.user.email)
    if (typeof size !== 'number') {
      throw new Error('Failed to get uploaded size')
    }

    const newSize = Number(size) + Number(data.size)
    if (newSize > config.FILE_UPLOADS.MAX_STORAGE_SIZE_BYTES) {
      return res.status(400).json({
        error: { upload: 'Storage limit exceeded.' },
        message: 'Action failed',
        success: false,
      })
    }

    // delete old upload if overwrite is enabled
    if (config.FILE_UPLOADS.OVERWRITE_EXISTING) {
      const upload = await Upload.findOne({
        name: data.name,
        folder: data.folder,
        owner: req.user.email,
      })
      if (upload) {
        fs.unlink(`${config.IO.UPLOADED_FILES_DIR}/${upload.code}`, () => {})
        await Upload.deleteOne({ code: upload.code })
      }
    }

    // upload file
    let code = `${randomize('Aa0', 16)}.${data.type}`
    let uploadHome = `${config.IO.UPLOADED_FILES_DIR}/${code}`
    while (fs.existsSync(uploadHome)) {
      code = randomize('Aa0', 16)
      uploadHome = `${config.IO.UPLOADED_FILES_DIR}/${code}`
    }

    // save uploaded file
    const { file } = req.files
    await file.mv(`${uploadHome}`, err => {
      if (err) {
        logger.error(err)
        throw err
      }
    })
    logger.debug(`upload: ${uploadHome}`)
    // add to DB
    const newData = new Upload({
      name: data.name,
      folder: data.folder,
      type: data.type,
      size: data.size,
      owner: req.user.email,
      code,
    })
    await newData.save()

    // check if user folder is enabled
    if (config.FILE_UPLOADS.USER_FOLDER_IS_ENABLED) {
      const user = await User.findOne({ email: req.user.email })
      if (!user) {
        throw new Error(`User not found: ${req.user.email}`)
      }
      // user folder in upload directory
      const userUploadDir = `${config.IO.UPLOADED_USER_DIR}/${user.id}`
      if (!fs.existsSync(userUploadDir)) {
        fs.mkdirSync(userUploadDir, { recursive: true })
      }
      const folder = data.folder.trim().replace(/\s+/g, '_')
      if (folder) {
        const folderPath = `${userUploadDir}/${folder}`
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true })
        }
      }
      const target = `${userUploadDir}/${folder}/${data.name}`
      // delete target if it exists
      fs.unlinkSync(target, () => {})
      // create a symlink to the uploaded file in the user folder
      fs.symlinkSync(uploadHome, target)
    }

    return res.send({
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Add upload failed: ${err}`)

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Update upload
const updateOne = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/uploads update: ${req.params.code}`)

    const query = {
      status: { $ne: 'delete' },
      code: { $eq: req.params.code },
      owner: { $eq: req.user.email },
    }
    const upload = await updateUpload(query, req)

    if (!upload) {
      logger.error(`upload ${req.params.code} not found or access denied.`)
      return res.status(400).json({
        error: {
          upload: `upload ${req.params.code} not found or access denied`,
        },
        message: 'Action failed',
        success: false,
      })
    }
    return res.send({
      upload,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Update upload failed: ${err}`)

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Find all uploads owned by user
const getOwn = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/uploads: ${req.user.email}`)
    const uploads = await Upload.find({
      status: { $ne: 'delete' },
      owner: { $eq: req.user.email },
    }).sort([['updated', -1]])

    return res.send({
      uploads,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Get user uploads failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Find the size of all uploads owned by user
const getInfo = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/uploads/info: ${req.user.email}`)
    // get folder options
    const options = await getUploadFolderOptions(req.user.email)
    const size = await getUploadedSize(req.user.email)
    if (typeof size !== 'number') {
      throw new Error('Failed to get uploaded size')
    }
    return res.json({
      uploadedSize: size,
      maxStorageSizeBytes: config.FILE_UPLOADS.MAX_STORAGE_SIZE_BYTES,
      daysKept: config.FILE_UPLOADS.FILE_LIFETIME_DAYS,
      maxFileSizeBytes: config.FILE_UPLOADS.MAX_FILE_SIZE_BYTES,
      allowedExtensions: config.FILE_UPLOADS.ALLOWED_EXTENSIONS,
      folderOptions: options,
      note: config.FILE_UPLOADS.OVERWRITE_EXISTING
        ? 'Warning: The system will overwrite any previously uploaded files with the same name in the upload list.'
        : null,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Get upload info failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Find all uploads that user can access to
const getAll = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/uploads/files: ${req.user.email}`)
    // find all files owned by user and shared to user or public
    const uploadDir = config.IO.UPLOADED_FILES_DIR
    const query = {
      status: { $ne: 'delete' },
      $or: [
        { owner: { $eq: req.user.email } },
        { sharedTo: req.user.email },
        { public: true },
      ],
    }
    if (req.body.fileTypes) {
      if (req.body.endsWith) {
        query.name = { $regex: req.body.fileTypes[0] }
      } else {
        query.type = { $in: req.body.fileTypes }
      }
    }

    const uploads = await Upload.find(query).sort([['updated', -1]])
    const files = []
    let i = 0
    // make sure the FileBrowser key is unique
    const fNameMap = new Map()
    for (i; i < uploads.length; i += 1) {
      const upload = uploads[i]
      let fName = upload.name
      let cnt = fNameMap.get(`${upload.owner}/${upload.folder}/${fName}`)
      if (cnt) {
        fName += ` (${cnt})`
        cnt += 1
      } else {
        cnt = 1
      }
      fNameMap.set(`${upload.owner}/${upload.folder}/${upload.name}`, cnt)

      const file = `${uploadDir}/${upload.code}`
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file)
        const dfile = {
          key: `uploads/${upload.owner}/${upload.folder}/${fName}`,
          path: `uploads/${upload.code}`,
          filePath: `${uploadDir}/${upload.code}`,
          size: stats.size,
          modified: Number(new Date(stats.mtime)),
        }
        files.push(dfile)
      }
    }

    return res.json({
      fileData: files,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Get all uploads failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

module.exports = {
  addOne,
  updateOne,
  getOwn,
  getInfo,
  getAll,
}
