import React, { useState, useEffect } from 'react'
import { Input, InputGroup } from 'reactstrap'
import { Box } from '@mui/material'
import Fab from '@mui/material/Fab'
import { List, Visibility, DeleteForever } from '@mui/icons-material'
import { colors } from 'src/util'
import { FileBrowserDialog, FileViewerDialog, LoaderDialog } from '../../common/Dialogs'
import { postData, fetchFile, defaults, apis } from '../../common/util'

export const FileSelector = (props) => {
  const inputStyle = defaults.inputStyle
  const inputStyleWarning = defaults.inputStyleWarning
  const [file, setFile] = useState(null)
  const [file_path, setFile_path] = useState('')
  const [files_loading, setFiles_loading] = useState(false)
  const [disable_view_file, setDisable_view_file] = useState(true)
  const [disable_input, setDisable_input] = useState(!props.enableInput)
  const [cleanup_input, setCleanup_input] = useState(props.cleanupInput)
  const [view_file, setView_file] = useState(false)
  const [file_content, setFile_content] = useState('')
  const [openFBModal, setOpenFBModal] = useState(false)
  const [files, setFiles] = useState([])

  useEffect(() => {
    deleteFile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.reset])

  const loadFiles = () => {
    setFiles_loading(true)
    const userData = {
      projectTypes: props.projectTypes,
      projectScope: props.projectScope,
      fileTypes: props.fileTypes,
      projectStatuses: props.projectStatuses,
      endsWith: props.endsWith,
    }

    //project files
    var promise1 = new Promise((resolve, reject) => {
      if (props.dataSources.includes('project')) {
        let serverFiles = postData(apis.userProjectFiles, userData)
          .then((data) => {
            //console.log(data)
            return data.fileData
          })
          .catch((error) => {
            reject(error)
          })
        resolve(serverFiles)
      } else {
        resolve([])
      }
    })

    //uploaded files
    var promise2 = new Promise((resolve, reject) => {
      if (props.dataSources.includes('upload')) {
        let serverFiles = postData(apis.userUploadFiles, userData)
          .then((data) => {
            return data.fileData
          })
          .catch((error) => {
            reject(error)
          })
        resolve(serverFiles)
      } else {
        resolve([])
      }
    })

    //public files
    var promise3 = new Promise((resolve, reject) => {
      if (props.dataSources.includes('public')) {
        let serverFiles = postData(apis.userPublicFiles, userData)
          .then((data) => {
            return data.fileData
          })
          .catch((error) => {
            reject(error)
          })
        resolve(serverFiles)
      } else {
        resolve([])
      }
    })

    //globus data
    var promise4 = new Promise((resolve, reject) => {
      if (props.dataSources.includes('globus')) {
        let serverFiles = postData(apis.userGlobusFiles, userData)
          .then((data) => {
            return data.fileData
          })
          .catch((error) => {
            reject(error)
          })
        resolve(serverFiles)
      } else {
        resolve([])
      }
    })

    Promise.all([promise1, promise2, promise3, promise4])
      .then((retfiles) => {
        let allfiles = [].concat.apply([], retfiles)
        //console.log(allfiles)
        setFiles(allfiles)
        setFiles_loading(false)

        setOpenFBModal(true)
      })
      .catch((error) => {
        setFiles_loading(false)

        setOpenFBModal(false)
        alert(error)
      })
  }

  const selectFile = () => {
    loadFiles()
  }

  const handleSelectedFile = (fileKey) => {
    // Don't allow modifying selected file
    setDisable_input(true)
    setCleanup_input(props.cleanupInput)
    setOpenFBModal(false)
    setFile_path(fileKey.path)
    setFile(fileKey.key)
    if (props.viewFile === true) {
      setDisable_view_file(false)
    }

    props.onChange(fileKey.filePath, props.fieldname, props.index, fileKey.key, fileKey)
  }

  const handleUserInputFile = (filename) => {
    setFile_path(filename)
    setFile(filename)
    if (props.viewFile === true) {
      setDisable_view_file(false)
    }
    props.onChange(filename, props.fieldname, props.index, filename, {
      key: filename,
      path: filename,
      url: filename,
      filePath: filename,
    })
  }

  const toggleFBModal = () => {
    setOpenFBModal(!openFBModal)
  }

  const viewFile = () => {
    let url = file_path
    fetchFile(url)
      .then((data) => {
        //console.log("data:", data);
        setFile_content(data)
        setView_file(true)
      })
      .catch((error) => {
        alert(error)
      })
  }
  const deleteFile = () => {
    setDisable_input(!props.enableInput)
    setCleanup_input(props.cleanupInput)
    setFile_path('')
    setFile('')
    props.onChange('', props.fieldname, props.index, '', null)
  }

  return (
    <>
      <LoaderDialog loading={files_loading} text="loading..." />
      <FileBrowserDialog
        isOpen={openFBModal}
        files={files}
        title="Select a file"
        noFilesMessage="No file found."
        handleSelectedFile={handleSelectedFile}
        toggle={toggleFBModal}
      />
      <FileViewerDialog
        type={props.viewFileType}
        isOpen={view_file}
        toggle={(e) => setView_file(!view_file)}
        title={file_path}
        src={file_content}
      />
      <InputGroup>
        <Input
          style={
            // eslint-disable-next-line prettier/prettier
            ((props.isOptional && !file) || props.isValidFileInput)
              ? inputStyle
              : inputStyleWarning
          }
          type="text"
          onChange={(e) => handleUserInputFile(e.target.value)}
          placeholder={props.placeholder ? props.placeholder : 'Select a file'}
          value={file || ''}
          disabled={disable_input}
        />
        <Box sx={{ display: 'flex', gap: '0rem' }}>
          <Fab
            size="small"
            style={{
              zIndex: '999',
              marginLeft: 10,
              color: colors.primary,
              backgroundColor: 'white',
            }}
          >
            <List onClick={selectFile} />
          </Fab>
          {!disable_view_file && (
            <Fab
              size="small"
              style={{
                zIndex: '999',
                marginLeft: 10,
                color: colors.primary,
                backgroundColor: 'white',
              }}
            >
              <Visibility onClick={viewFile} />
            </Fab>
          )}
          {props.cleanupInput && cleanup_input && file && (
            <Fab
              size="small"
              style={{
                zIndex: '999',
                marginLeft: 10,
                color: colors.primary,
                backgroundColor: 'white',
              }}
            >
              <DeleteForever onClick={deleteFile} />
            </Fab>
          )}
        </Box>
      </InputGroup>
    </>
  )
}

export default FileSelector
