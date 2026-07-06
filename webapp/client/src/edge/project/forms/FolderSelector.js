import React, { useState, useEffect } from 'react'
import { Input, InputGroup } from 'reactstrap'
import { Box } from '@mui/material'
import Fab from '@mui/material/Fab'
import { List, DeleteForever } from '@mui/icons-material'
import { colors } from 'src/util'
import { FolderBrowserDialog, LoaderDialog } from '../../common/Dialogs'
import { postData, defaults, apis } from '../../common/util'

export const FolderSelector = (props) => {
  const inputStyle = defaults.inputStyle
  const inputStyleWarning = defaults.inputStyleWarning
  const [files_loading, setFiles_loading] = useState(false)
  const [cleanup_input, setCleanup_input] = useState(props.cleanupInput)
  const [openFBModal, setOpenFBModal] = useState(false)
  const [files, setFiles] = useState([])
  const [disable_select, setDisable_select] = useState(true)
  const [folder, setFolder] = useState(null)
  const [folder_path, setFolder_path] = useState('')

  useEffect(() => {
    deleteFolder()
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
    setDisable_select(true)
  }

  const handleSelectedFolder = (fileKey) => {
    // Don't allow modifying selected file
    setDisable_select(false)
    setFolder(fileKey)
  }

  const handleClickSelect = () => {
    if (!folder) return
    const fileKey = folder
    // Don't allow modifying selected file
    setDisable_select(true)
    setOpenFBModal(false)
    setFolder_path(fileKey.key)
    if (props.viewFile === true) {
      setDisable_view_file(false)
    }
    // find real path and get all files under the selected folder
    let pathParts = []
    let realPathParts = []
    let filesInFolder = []
    files.forEach((f) => {
      if (f.key.startsWith(fileKey.key)) {
        filesInFolder.push(f.filePath)
        let newPathParts = f.key.split('/')
        let newRealPathParts = f.filePath.split('/')
        newPathParts.pop()
        newRealPathParts.pop()
        if (pathParts.length === 0 || newPathParts.length < pathParts.length) {
          pathParts = newPathParts
        }
        if (realPathParts.length === 0 || newRealPathParts.length < realPathParts.length) {
          realPathParts = newRealPathParts
        }
      }
    })
    //console.log('Files under the selected folder:', filesInFolder)

    props.onChange(realPathParts.join('/'), pathParts.join('/'), filesInFolder)
  }

  const toggleFBModal = () => {
    setOpenFBModal(!openFBModal)
  }
  const deleteFolder = () => {
    setCleanup_input(props.cleanupInput)
    setFolder_path('')
    setFolder('')
    props.onChange('', '', [], props.fieldname)
  }

  return (
    <>
      <LoaderDialog loading={files_loading} text="loading..." />
      <FolderBrowserDialog
        isOpen={openFBModal}
        files={files}
        title="Select a Folder"
        noFilesMessage="No folder found."
        handleSelectedFile={handleSelectedFile}
        handleSelectedFolder={handleSelectedFolder}
        handleClickSelect={handleClickSelect}
        toggle={toggleFBModal}
        disable_select={disable_select}
      />
      <InputGroup>
        <Input
          style={
            // eslint-disable-next-line prettier/prettier
            (props.isOptional || folder)
              ? inputStyle
              : inputStyleWarning
          }
          type="text"
          placeholder={props.placeholder ? props.placeholder : 'Select a folder'}
          value={folder ? folder_path : ''}
          disabled={true}
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
          {props.cleanupInput && cleanup_input && folder && (
            <Fab
              size="small"
              style={{
                zIndex: '999',
                marginLeft: 10,
                color: colors.primary,
                backgroundColor: 'white',
              }}
            >
              <DeleteForever onClick={deleteFolder} />
            </Fab>
          )}
        </Box>
      </InputGroup>
    </>
  )
}

export default FolderSelector
