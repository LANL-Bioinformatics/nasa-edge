const axios = require('axios')
const ufs = require('url-file-size')
const fs = require('fs')
const path = require('path')
const { exec, spawn } = require('child_process')
const logger = require('./logger')
const Upload = require('../edge-api/models/upload')
const config = require('../config')

// append message to a log
const write2log = (log, msg) => {
  fs.appendFile(log, `${msg}\n`, err => {
    if (err) logger.error(`Failed to write to ${log}: ${err}`)
  })
}

// post data
const postData = (url, params, header) =>
  new Promise((resolve, reject) => {
    axios
      .post(url, params, header)
      .then(response => {
        const { data } = response
        resolve(data)
      })
      .catch(err => {
        if (err.response) {
          reject(err.response)
        } else {
          reject(err)
        }
      })
  })

// get data
const getData = url =>
  new Promise((resolve, reject) => {
    axios
      .get(url)
      .then(response => {
        const { data } = response
        resolve(data)
      })
      .catch(err => {
        if (err.response) {
          reject(err.response)
        } else {
          reject(err)
        }
      })
  })

const timeFormat = d => {
  let hours = d.days() * 24 + d.hours()
  if (hours < 10) {
    hours = `0${hours}`
  }
  let minutes = d.minutes()
  if (minutes < 10) {
    minutes = `0${minutes}`
  }
  let seconds = d.seconds()
  if (seconds < 10) {
    seconds = `0${seconds}`
  }
  return `${hours}:${minutes}:${seconds}`
}

// Get file data for file browser
// Return all files matched the extentions in a directory and sub directories
const getAllFiles = (
  dirPath,
  arrayOfFilesIn,
  extentions,
  displayPath,
  apiPath,
  fileRelPath,
) => {
  const files = fs.readdirSync(dirPath)

  let arrayOfFiles = arrayOfFilesIn || []

  files.forEach(file => {
    try {
      if (fs.statSync(`${dirPath}/${file}`).isDirectory()) {
        arrayOfFiles = getAllFiles(
          `${dirPath}/${file}`,
          arrayOfFiles,
          extentions,
          `${displayPath}/${file}`,
          `${apiPath}/${file}`,
          `${fileRelPath}/${file}`,
        )
      } else {
        let pass = false
        if (extentions && extentions.length > 0) {
          for (let i = 0; i < extentions.length; i += 1) {
            if (file === extentions[i]) {
              pass = true
            } else if (file.endsWith(`.${extentions[i]}`)) {
              pass = true
            }
          }
        } else {
          // get all files
          pass = true
        }
        if (pass) {
          const newFilePath = path.join(dirPath, '/', file)
          const newFileRelPath = path.join(fileRelPath, '/', file)
          const stats = fs.statSync(newFilePath)
          const newDisplayPath = path.join(displayPath, '/', file)
          const newApiPath = path.join(apiPath, '/', file)
          arrayOfFiles.push({
            key: newDisplayPath,
            name: file,
            path: newApiPath,
            url: newApiPath,
            filePath: newFileRelPath,
            size: stats.size,
            modified: Number(new Date(stats.mtime)),
          })
        }
      }
    } catch (err) {
      logger.error(`getAllFile failed: ${err}`)
    }
  })

  return arrayOfFiles
}

// Get file data for react-dropdown-tree-select file browser
const getTreeFiles = (dirPath, displayPath, apiPath, fileRelPath) => {
  const files = fs.readdirSync(dirPath)

  const arrayOfFiles = []

  files.forEach(file => {
    try {
      const newFilePath = path.join(dirPath, '/', file)
      const newFileRelPath = path.join(fileRelPath, '/', file)
      const newDisplayPath = path.join(displayPath, '/', file)
      const newApiPath = path.join(apiPath, '/', file)
      if (fs.statSync(`${dirPath}/${file}`).isDirectory()) {
        const children = getTreeFiles(
          `${dirPath}/${file}`,
          `${displayPath}/${file}`,
          `${apiPath}/${file}`,
          `${fileRelPath}/${file}`,
        ).sort(
          (a, b) =>
            b.type.localeCompare(a.type) || a.label.localeCompare(b.label),
        )
        arrayOfFiles.push({
          // use display path as id to avoid duplicated id when files with same name in different folders
          // replace leading / in display path to avoid issue in zip files from output folder
          id: newDisplayPath.replace(/^\//, ''),
          value: file,
          path: newApiPath,
          url: newApiPath,
          filePath: newFileRelPath,
          label: file,
          children,
          disabled: false,
          className: 'folder',
          type: 'folder',
        })
      } else {
        const stats = fs.statSync(newFilePath)
        const className =
          path.extname(file).toLowerCase().replace('.', '') || 'unknown'
        arrayOfFiles.push({
          id: newDisplayPath.replace(/^\//, ''),
          value: file,
          path: newApiPath,
          url: newApiPath,
          filePath: newFileRelPath,
          size: stats.size,
          modified: Number(new Date(stats.mtime)),
          label: `${file} (${(stats.size / 1024).toFixed(2)} KB)`,
          children: [],
          disabled: false,
          className: `file file-${className}`,
          type: 'file',
        })
      }
    } catch (err) {
      logger.error(`getTreeFile failed: ${err}`)
    }
  })

  return arrayOfFiles
}

const fileStats = async file => {
  let stats = {}
  if (!file) {
    return { size: 0 }
  }
  if (file.toLowerCase().startsWith('http')) {
    stats = await ufs(file)
      .then(size => ({ size }))
      .catch(() => ({ size: 0 }))
  } else if (fs.existsSync(file)) {
    stats = fs.statSync(file)
  } else {
    stats = { size: 0 }
  }
  return stats
}

const findInputsize = async projectConf => {
  if (!projectConf.files) {
    return 0
  }
  let size = 0
  await Promise.all(
    projectConf.files.map(async file => {
      if (file !== '') {
        // not optional file without input
        const stats = await fileStats(file)
        size += stats.size
      }
    }),
  )
  return size
}

const execCmd = cmd =>
  new Promise((resolve, reject) => {
    // run local
    logger.info(`exec: ${cmd}`)
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        logger.error(error)
        reject(error)
      }
      if (stderr) {
        logger.error(`exec stderr: ${stderr}`)
        resolve({ code: -1, message: stderr })
      }
      logger.info(`exec stdout: ${stdout}`)
      resolve({ code: 0, message: stdout })
    })
  })

const spawnCmd = (cmd, outLog) => {
  const out = fs.openSync(outLog, 'a')
  const err = fs.openSync(outLog, 'a')
  const child = spawn(cmd, {
    shell: true, // have to use shell, otherwise the trame instance will be stopped when restarting the webapp
    stdio: ['ignore', out, err], // piping stdout and stderr to out.log
    detached: true,
  })
  child.unref()
  return child.pid
}

const sleep = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

// check pid
const pidIsRunning = pid => {
  try {
    // a signal of 0 can be used to test for the existence of a process.
    process.kill(pid, 0)
    return true
  } catch (e) {
    return false
  }
}

const linkCopyFile = async (file, dir, action, uploadOnly) => {
  try {
    // create dir
    const inputDir = dir
    if (!fs.existsSync(inputDir)) {
      fs.mkdirSync(inputDir)
    }
    let name = path.basename(file)
    let linkedName = `${inputDir}/${name}`
    if (file.startsWith(config.IO.UPLOADED_FILES_DIR)) {
      // link uploaded file with realname
      const upload = await Upload.findOne({ code: name })
      if (upload) {
        name = upload.name
      }
      linkedName = `${inputDir}/${name}`
      let i = 1
      // handle duplicated uploaded files
      while (fs.existsSync(linkedName)) {
        i += 1
        if (name.includes('.')) {
          const newName = name.replace('.', `${i}.`)
          linkedName = `${inputDir}/${newName}`
        } else {
          linkedName = `${inputDir}/${name}${i}`
        }
      }
      if (action === 'link') {
        fs.symlinkSync(file, linkedName, 'file')
      } else {
        fs.copyFileSync(file, linkedName)
      }
    } else if (!uploadOnly) {
      if (action === 'link') {
        fs.symlinkSync(file, linkedName, 'file')
      } else {
        fs.copyFileSync(file, linkedName)
      }
    }
    return linkedName
  } catch (err) {
    return Promise.reject(err)
  }
}

// The output zip file is in the io/tmp/<random> dir, and the zip file name is <project_name>_outputs.tgz
const zipFiles = async (name, filePath, files) => {
  const cmd = `tar -czf ${name} -C ${filePath} ${files.join(' ')}`
  await execCmd(cmd)
  if (fs.existsSync(name)) {
    return name
  }
  return null
}

module.exports = {
  write2log,
  postData,
  getData,
  timeFormat,
  getAllFiles,
  getTreeFiles,
  findInputsize,
  execCmd,
  spawnCmd,
  sleep,
  pidIsRunning,
  linkCopyFile,
  zipFiles,
}
