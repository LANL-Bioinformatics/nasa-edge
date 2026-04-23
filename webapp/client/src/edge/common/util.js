import axios from 'axios'
import { toast } from 'react-toastify'
import { colors } from 'src/util'

export const apis = {
  publicProjects: '/api/public/projects',
  register: '/api/user/register',
  login: '/api/user/login',
  oauthLogin: '/api/user/oauthLogin',
  activate: '/api/user/activate',
  getActivationLink: '/api/user/getActivationLink',
  resetPassword: '/api/user/resetPassword',
  getResetPasswordLink: '/api/user/getResetPasswordLink',
  jobQueue: '/api/auth-user/projects/queue',
  userInfo: '/api/auth-user/info',
  userProjects: '/api/auth-user/projects',
  userAllProjects: '/api/auth-user/projects/all',
  userUsers: '/api/auth-user/users',
  userUpdate: '/api/auth-user',
  uploadsInfo: '/api/auth-user/uploads/info',
  userUploads: '/api/auth-user/uploads',
  userProjectFiles: '/api/auth-user/projects/files',
  userUploadFiles: '/api/auth-user/uploads/files',
  userPublicFiles: '/api/auth-user/data/public',
  userGlobusFiles: '/api/auth-user/data/globus',
  userBulkSubmissions: '/api/auth-user/bulkSubmissions',
  adminProjects: '/api/admin/projects',
  adminUsers: '/api/admin/users',
  adminUploads: '/api/admin/uploads',
  adminBulkSubmissions: '/api/admin/bulkSubmissions',
  workflowDocs: '/workflow-docs',
  tmp: '/tmp',
}

export const defaults = {
  //onSubmit, onBlur, onChange
  form_mode: 'onChange',
  showTooltip: true,
  tooltipPlace: 'right',
  tooltipColor: colors.app,
  inputStyle: { borderRadius: '5px' },
  inputStyleWarning: {
    borderRadius: '5px',
    borderLeftColor: colors.danger,
    borderLeftWidth: '2px',
  },
}

// set token to API request header
export const setAuthToken = (token) => {
  if (token) {
    // Apply authorization token to every request if logged in
    axios.defaults.headers.common['Authorization'] = token
  } else {
    // Delete auth header
    delete axios.defaults.headers.common['Authorization']
  }
}

// post data
export const postData = (url, params) => {
  return new Promise((resolve, reject) => {
    axios
      .post(url, params)
      .then((response) => {
        const data = response.data
        resolve(data)
      })
      .catch((err) => {
        if (err.response) {
          reject(err.response.data)
        } else {
          reject(err)
        }
      })
  })
}

// update data
export const putData = (url, params) => {
  return new Promise((resolve, reject) => {
    axios
      .put(url, params)
      .then((response) => {
        const data = response.data
        resolve(data)
      })
      .catch((err) => {
        if (err.response) {
          reject(err.response.data)
        } else {
          reject(err)
        }
      })
  })
}

// update data
export const deleteData = (url, params) => {
  return new Promise((resolve, reject) => {
    axios
      .delete(url, params)
      .then((response) => {
        const data = response.data
        resolve(data)
      })
      .catch((err) => {
        if (err.response) {
          reject(err.response.data)
        } else {
          reject(err)
        }
      })
  })
}

//fetch data
export const getData = (url) => {
  return new Promise((resolve, reject) => {
    axios
      .get(url)
      .then((response) => {
        const data = response.data
        resolve(data)
      })
      .catch((err) => {
        if (err.response) {
          reject(err.response.data)
        } else {
          reject(err)
        }
      })
  })
}

//fetch file
export const fetchFile = (url) => {
  return new Promise((resolve, reject) => {
    axios
      .get(url)
      .then((response) => {
        const data = response.data
        //console.log(data)
        resolve(data)
      })
      .catch((err) => {
        if (err.response) {
          reject(err.response.data)
        } else {
          reject(err)
        }
      })
  })
}

// action notification
export const notify = (type, msg, timeout) => {
  if (!timeout) timeout = 2000
  if (type === 'success') {
    toast.success(msg, {
      position: 'top-center',
      autoClose: timeout,
      rtl: false,
      hideProgressBar: false,
    })
  }
  if (type === 'error') {
    toast.error(msg, {
      position: 'top-center',
      autoClose: false,
      rtl: false,
      hideProgressBar: false,
    })
  }
}

// format file size
export const formatFileSize = (number) => {
  if (number < 1024) {
    return number + 'bytes'
  } else if (number >= 1024 && number < 1048576) {
    return (number / 1024).toFixed(1) + 'KB'
  } else if (number >= 1048576 && number < 1073741824) {
    return (number / 1048576).toFixed(1) + 'MB'
  } else if (number >= 1073741824) {
    return (number / 1073741824).toFixed(1) + 'GB'
  }
}

export const getFileExtension = (name) => {
  const parts = name.split('.')
  const len = parts.length
  let ext = parts[len - 1]
  if (ext === 'gz' && len > 2) {
    ext = parts[len - 2] + '.gz'
  }
  return ext.toLowerCase()
}

// ORCID login
export const popupWindow = (url, windowName, win, w, h) => {
  const y = win.top.outerHeight / 2 + win.top.screenY - h / 2
  const x = win.top.outerWidth / 2 + win.top.screenX - w / 2
  return win.open(
    url,
    windowName,
    `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${w}, height=${h}, top=${y}, left=${x}`,
  )
}

// validators
export const isValidProjectName = (name) => {
  const regexp = new RegExp(/^[a-zA-Z0-9\-_.]{3,30}$/)
  return regexp.test(name.trim())
}

export const isValidFileInput = (filename, path) => {
  const regexp = new RegExp(
    /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)\/[a-zA-Z0-9()]{1}/,
    'i',
  )

  if (filename === path) {
    //text input must be a http(s) url
    return regexp.test(filename)
  } else {
    //input from file selector
    return true
  }
}

export const isValidFolder = (inputValue) => {
  const regexp = new RegExp(/^[a-zA-Z0-9\-_/ ]+$/, 'i')
  return regexp.test(inputValue.replace(/\s+/g, ' ').trim())
}

export const isValidEvalue = (inputValue) => {
  const regexp = new RegExp(/^([1-9]\.[0-9]+|[1-9])e-[0-9]+$/, 'i')
  return regexp.test(inputValue.replace(/\s+/g, ' ').trim())
}

export const isValidSRAAccessionInput = (accessions) => {
  const parts = accessions.split(',')
  for (var i = 0; i < parts.length; i++) {
    if (!isValidSRAAccession(parts[i])) {
      return false
    }
  }
  return true
}

export const isValidSRAAccession = (accession) => {
  //if(!/^[a-zA-Z]{3}[0-9]{6,9}$/.test(accession)) {
  if (
    !/^(srp|erp|drp|srx|erx|drx|srs|ers|drs|srr|err|drr|sra|era|dra)[0-9]{6,9}$/i.test(
      accession.trim(),
    )
  ) {
    return false
  }
  return true
}

export const capitalizeFirstLetter = (str) => {
  if (!str) {
    return '' // Handle empty strings
  }
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
