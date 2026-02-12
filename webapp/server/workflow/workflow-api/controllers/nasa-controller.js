const randomize = require('randomatic');
const fs = require('fs');
const Upload = require('../../edge-api/models/upload');
const User = require('../../edge-api/models/user');
const { getUploadedSize, updateUpload } = require('../../edge-api/utils/upload');
const logger = require('../../utils/logger');
const config = require('../../config');

const sysError = config.APP.API_ERROR;

// Create a upload
const addOne = async (req, res) => {
  try {
    const data = req.body;
    logger.debug(`/api/auth-user/nasa/uploads add: ${JSON.stringify(data)}`);

    // check storage size
    const size = await getUploadedSize(req.user.email);
    if (typeof size !== 'number') {
      throw new Error('Failed to get uploaded size');
    }

    const newSize = Number(size) + Number(data.size);
    if (newSize > config.FILE_UPLOADS.MAX_STORAGE_SIZE_BYTES) {
      return res.status(400).json({
        error: { upload: 'Storage limit exceeded.' },
        message: 'Action failed',
        success: false
      });
    }

    // find user
    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      throw new Error(`User not found: ${req.user.email}`);
    }
    // user folder in upload directory
    const userUploadDir = `${config.IO.UPLOADED_USER_DIR}/${user.id}`;
    if (!fs.existsSync(userUploadDir)) {
      fs.mkdirSync(userUploadDir);
    }
    const target = `${userUploadDir}/${data.name}`;

    // check if file already exists
    const upload = await Upload.findOne({ 'name': data.name, owner: req.user.email });
    if (upload) {
      // delete old upload and link
      fs.unlink(target, () => {
      });
      const oldpath = `${config.IO.UPLOADED_FILES_DIR}/${upload.code}`;
      fs.unlink(oldpath, () => {
      });
      await Upload.deleteOne({ code: upload.code });
    }

    // generate a random code
    let code = `${randomize('Aa0', 16)}.${data.type}`;
    let uploadHome = `${config.IO.UPLOADED_FILES_DIR}/${code}`;
    while (fs.existsSync(uploadHome)) {
      code = randomize('Aa0', 16);
      uploadHome = `${config.IO.UPLOADED_FILES_DIR}/${code}`;
    }
    logger.debug(`upload: ${uploadHome}`);
    // add to DB
    const newData = new Upload({
      name: data.name,
      folder: data.folder,
      type: data.type,
      size: data.size,
      owner: req.user.email,
      code
    });
    await newData.save();

    // save uploaded file
    const { file } = req.files;
    await file.mv(`${uploadHome}`, (err) => {
      if (err) {
        logger.error(err);
        throw err;
      }
    });
    // create symlink
    fs.symlinkSync(uploadHome, target);
    // return success
    return res.send({
      message: 'Action successful',
      success: true
    });
  } catch (err) {
    logger.error(`Add upload failed: ${err}`);

    return res.status(500).json({
      message: sysError,
      success: false
    });
  }
};

// Update upload
const updateOne = async (req, res) => {
  try {
    logger.debug(`/api/auth-user/nasa/uploads update: ${req.params.code}`);

    const query = {
      status: { $ne: 'delete' },
      code: { $eq: req.params.code },
      owner: { $eq: req.user.email }
    };
    const upload = await updateUpload(query, req);

    if (!upload) {
      logger.error(`upload ${req.params.code} not found or access denied.`);
      return res.status(400).json({
        error: { upload: `upload ${req.params.code} not found or access denied` },
        message: 'Action failed',
        success: false
      });
    }
    if (upload.status === 'delete') {
      // delete file and link
      // find user
      const user = await User.findOne({ email: req.user.email });
      if (!user) {
        throw new Error(`User not found: ${req.user.email}`);
      }
      // user folder in upload directory
      const userUploadDir = `${config.IO.UPLOADED_USER_DIR}/${user.id}`;
      const target = `${userUploadDir}/${upload.name}`;

      // delete old upload and link
      fs.unlink(target, () => {
      });
      const oldpath = `${config.IO.UPLOADED_FILES_DIR}/${upload.code}`;
      fs.unlink(oldpath, () => {
      });
      await Upload.deleteOne({ code: upload.code });
    }

    return res.send({
      upload,
      message: 'Action successful',
      success: true
    });
  } catch (err) {
    logger.error(`Update upload failed: ${err}`);

    return res.status(500).json({
      message: sysError,
      success: false
    });
  }
};

module.exports = {
  addOne,
  updateOne,
};
