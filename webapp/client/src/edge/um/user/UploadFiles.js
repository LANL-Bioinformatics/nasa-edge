import React, { useState, useEffect } from 'react'
import 'react-dropzone-uploader/dist/styles.css'
import Dropzone from 'react-dropzone-uploader'
import { ToastContainer } from 'react-toastify'
import {
  notify,
  formatFileSize,
  getData,
  postData,
  getFileExtension,
  apis,
} from '../../common/util'
import 'react-toastify/dist/ReactToastify.css'

import { LoaderDialog } from '../../common/Dialogs'
import { MyCreatableSelect } from '../../common/MySelect'
import config from 'src/config'

const UploadFiles = (props) => {
  const defaultFolder = 'main'
  const [folder, setFolder] = useState(defaultFolder)
  const [submitting, setSubmitting] = useState(false)
  const [uploadInfo, setUploadInfo] = useState({})
  const [uploadingSize, setUploadingSize] = useState(0)
  const [files, setFiles] = useState([])
  const [updateSize, setUpdateSize] = useState(0)
  const [files2upload, setFiles2Upload] = useState(0)
  const [filesUploaded, setFilesUploaded] = useState(0)
  let uploaded = 0

  useEffect(() => {
    //get upload info
    getData(apis.uploadsInfo)
      .then((data) => {
        setUploadInfo(data)
      })
      .catch((err) => {
        alert(err)
      })
  }, [submitting])

  useEffect(() => {
    let size = 0
    files.forEach((f) => {
      size += f.meta.size
    })
    setUploadingSize(size)
  }, [files, updateSize])

  const notValidFileExtension = (file) => {
    const ext = getFileExtension(file.meta.name)
    return !uploadInfo.allowedExtensions.split('|').includes(ext)
  }

  const validateFile = (file) => {
    if (file.meta.size === 0) {
      return true
    }
    if (notValidFileExtension(file)) {
      return true
    }
    return false
  }

  // called every time a file's `status` changes
  const handleChangeStatus = ({ meta }, status, allFiles) => {
    let deletFile = false

    if (status === 'error_file_size') {
      alert(meta.name + ': File too big')
      deletFile = true
    } else if (status === 'error_validation') {
      alert(meta.name + ': Wrong file extension or Empty file')
      deletFile = true
    } else if (status === 'removed') {
      if (!meta.validationError) {
        setFiles(allFiles)
        setUpdateSize(updateSize + 1)
      }
    } else if (status === 'done') {
      setFiles(allFiles)
      setUpdateSize(updateSize + 1)
    } else {
      //check duplicate
      allFiles.forEach((f) => {
        if (
          f.meta.id !== meta.id &&
          f.meta.name === meta.name &&
          f.meta.size === meta.size &&
          f.meta.type === meta.type &&
          f.meta.lastModifiedDate === meta.lastModifiedDate
        ) {
          alert(meta.name + ': File is already in the uploading list')
          deletFile = true
        }
      })
    }

    if (deletFile) {
      allFiles.forEach((f) => {
        if (f.meta.id === meta.id) {
          f.remove()
        }
      })
    }
  }

  // receives array of files that are done uploading when submit button is clicked
  const handleSubmit = (files, allFiles) => {
    setSubmitting(true)
    //check storage space
    if (uploadInfo.uploadedSize + uploadingSize > uploadInfo.maxStorageSizeBytes) {
      alert(
        'Storage limit exceeded. Please remove file(s) from your uploading list or delete old uploaded file(s) from the server.',
      )
      setSubmitting(false)
      return
    }

    //upload files
    setFiles2Upload(files.length)

    let promises = []
    for (var i = 0; i < files.length; i++) {
      let curr = files[i]
      promises.push(
        new Promise((resolve, reject) => {
          let formData = new FormData()
          formData.append('file', curr.file)
          formData.set('name', curr.meta.name)
          formData.set('type', getFileExtension(curr.meta.name))
          formData.set('size', curr.meta.size)
          formData.set('folder', folder.replace(/\s+/g, ' ').trim())

          const url = apis.userUploads
          postData(url, formData, {
            headers: {
              'Content-type': 'multipart/form-data',
            },
          })
            .then((response) => {
              uploaded += 1
              setFilesUploaded(uploaded)
              resolve('Upload ' + curr.meta.name + ' successfully!')
            })
            .catch((error) => {
              uploaded += 1
              setFilesUploaded(uploaded)
              resolve('Upload ' + curr.meta.name + ' failed! ' + error)
            })
        }),
      )
    }

    Promise.all(promises)
      .then((response) => {
        allFiles.forEach((f) => f.remove())
        let errors = 0
        response.forEach((e) => {
          if (e.includes('failed')) {
            notify('error', e)
            errors += 1
          } else {
            //notify('success', e)
          }
        })
        if (errors === 0) {
          notify('success', 'Files uploaded successfully!', 2000)
          //setTimeout(() => props.history.push("/user/files"), 2000);
        }
        setSubmitting(false)
        props.reloadTableData()
      })
      .catch((error) => {
        alert(error)
        setSubmitting(false)
      })
  }

  return (
    <>
      <LoaderDialog
        loading={submitting}
        text={`Uploading... ${files2upload > 5 ? Math.round((filesUploaded / files2upload) * 100) + '%' : ''}`}
      />
      <ToastContainer />
      <div className="clearfix">
        <h4 className="pt-3">Upload Files</h4>
        <span className="edge-text-font">
          Max single file size is {formatFileSize(uploadInfo.maxFileSizeBytes)}. Max server storage
          space is {formatFileSize(uploadInfo.maxStorageSizeBytes)}. Files will be kept for{' '}
          {uploadInfo.daysKept} days.
        </span>
        <br></br>
        Allowed file extensions are: {uploadInfo.allowedExtensions?.split('|').join(', ')}
        <br></br>
        {uploadInfo.note && (
          <span className="red-text">
            <br></br>
            {uploadInfo.note}
            <br></br>
          </span>
        )}
        <br></br>
        {config.APP.UPLOAD_FOLDER_IS_ENABLED && (
          <>
            Folder to store the uploaded files, default folder is &lsquo;{defaultFolder}&rsquo;
            <MyCreatableSelect
              options={uploadInfo.folderOptions}
              onChange={(e) => {
                if (e) {
                  setFolder(e.value)
                } else {
                  setFolder(defaultFolder)
                }
              }}
              placeholder="Select a folder or create a new one"
              isClearable={true}
            />
            <br></br>
          </>
        )}
        Storage space usage: {formatFileSize(uploadInfo.uploadedSize)}/
        {formatFileSize(uploadInfo.maxStorageSizeBytes)}
        <br></br>
        Uploading size: {formatFileSize(uploadingSize)}
        <Dropzone
          onChangeStatus={handleChangeStatus}
          onSubmit={handleSubmit}
          accept="*"
          autoUpload={false}
          maxSizeBytes={uploadInfo.maxFileSizeBytes}
          validate={validateFile}
        />
      </div>
    </>
  )
}

export default UploadFiles
