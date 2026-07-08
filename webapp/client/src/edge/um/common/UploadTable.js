import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import startCase from 'lodash.startcase'
import { MaterialReactTable } from 'material-react-table'
import { ThemeProvider, Box, IconButton, Tooltip } from '@mui/material'
import Fab from '@mui/material/Fab'
import {
  Delete,
  Edit,
  Refresh,
  PersonAdd,
  PersonAddDisabled,
  Lock,
  LockOpen,
} from '@mui/icons-material'
import moment from 'moment'

import { updateUploadAdmin } from 'src/redux/reducers/edge/adminSlice'
import { updateUpload } from 'src/redux/reducers/edge/userSlice'
import { setSubmittingForm } from 'src/redux/reducers/pageSlice'
import { cleanError } from 'src/redux/reducers/messageSlice'
import { ConfirmDialog } from '../../common/Dialogs'
import { notify, getData, formatFileSize, apis, isValidFolder } from '../../common/util'
import { theme, validateRequired, validateBoolean } from './tableUtil'
import UserSelector from './UserSelector'
import config from 'src/config'

const actionDialogs = {
  '': { message: 'This action is not undoable.' },
  update: { message: 'This action is not undoable.' },
  rerun: { message: 'This action is not undoable.' },
  delete: { message: 'This action is not undoable.' },
  share: { message: "You can use 'unshare' to undo this action." },
  unshare: { message: "You can use 'share' to undo this action." },
  publish: { message: "You can use 'unpublish' to undo this action." },
  unpublish: { message: "You can use 'publish' to undo this action." },
}

const UploadTable = (props) => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const user = useSelector((state) => state.user)
  const errors = useSelector((state) => state.message.errors)
  const page = useSelector((state) => state.page)

  const [table, setTable] = useState()
  const [tableData, setTableData] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedData, setSelectedData] = useState([])
  const [openDialog, setOpenDialog] = useState(false)
  const [action, setAction] = useState('')
  const [openUserSelector, setOpenUserSelector] = useState(false)
  const [userList, setUserlist] = useState([])
  const [uploads, setUploads] = useState()
  const [validationErrors, setValidationErrors] = useState({})

  useEffect(() => {
    if (props.tableType === 'admin' && user.profile.role !== 'admin') {
      navigate('/home')
    } else {
      getUploads()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, user])

  useEffect(() => {
    if (uploads && !page.submittingForm) {
      notifyUpdateResults()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploads, page])

  const handleSaveRowEdits = async ({ exitEditingMode, row, values }) => {
    if (!Object.keys(validationErrors).length) {
      const oldData = row.original
      let newData = {
        ...oldData,
        name: values.name,
        desc: values.desc,
        folder: values.folder,
        public: values.public,
      }
      let update = new Promise((resolve, reject) => {
        setOpenDialog(false)
        dispatch(cleanError())
        dispatch(setSubmittingForm(true))
        setUploads([])
        setAction('update')
        const uploadedFile = myUpdateUpload(newData, oldData)
        setUploads([uploadedFile])
        resolve(uploadedFile)
        //wait for upload updating complete
        setTimeout(() => {
          dispatch(setSubmittingForm(false))
        }, 200)
      })
      await update
      exitEditingMode() //required to exit editing mode and close modal
    }
  }

  const handleCancelRowEdits = () => {
    setValidationErrors({})
  }

  const getCommonEditTextFieldProps = useCallback(
    (cell) => {
      return {
        error: !!validationErrors[cell.id],
        helperText: validationErrors[cell.id],
        onBlur: (event) => {
          let isValid = validateRequired(event.target.value)
          if (cell.column.id === 'public') {
            isValid = validateBoolean(event.target.value)
          } else if (cell.column.id === 'folder') {
            isValid = isValidFolder(event.target.value)
          }
          if (!isValid) {
            //set validation error for cell if invalid
            if (cell.column.id === 'public') {
              setValidationErrors({
                ...validationErrors,
                [cell.id]: `${cell.column.columnDef.header} is required. Valid values: true, false`,
              })
            } else if (cell.column.id === 'folder') {
              setValidationErrors({
                ...validationErrors,
                [cell.id]: `${cell.column.columnDef.header} is invalid.`,
              })
            } else {
              setValidationErrors({
                ...validationErrors,
                [cell.id]: `${cell.column.columnDef.header} is required`,
              })
            }
          } else {
            //remove validation error for cell if valid
            delete validationErrors[cell.id]
            setValidationErrors({
              ...validationErrors,
            })
          }
        },
      }
    },
    [validationErrors],
  )
  //should be memoized or stable
  const columns = useMemo(
    () => [
      {
        header: 'File Name',
        accessorKey: 'name',
        muiTableBodyCellEditTextFieldProps: ({ cell }) => ({
          ...getCommonEditTextFieldProps(cell),
        }),
      },
      { header: 'Description', accessorKey: 'desc' },
      {
        header: 'Folder',
        accessorKey: 'folder',
        enableEditing: config.APP.UPLOAD_FOLDER_IS_DISABLED ? false : true,
        muiTableBodyCellEditTextFieldProps: ({ cell }) => ({
          ...getCommonEditTextFieldProps(cell),
        }),
      },
      { header: 'Type', accessorKey: 'type', enableEditing: false },
      {
        header: 'Size',
        accessorKey: 'size',
        enableEditing: false,
        Cell: ({ cell }) => <> {formatFileSize(cell.getValue())}</>,
        size: 100, //decrease the width of this column
      },
      { header: 'Owner', accessorKey: 'owner', enableEditing: false },
      {
        header: 'Shared',
        accessorKey: 'shared',
        Cell: ({ cell }) => <> {cell.getValue() ? 'true' : 'false'}</>,
        enableColumnActions: false,
        enableEditing: false,
        enableGlobalFilter: false,
        size: 100, //decrease the width of this column
      },
      {
        header: 'Public',
        accessorKey: 'public',
        Cell: ({ cell }) => <> {cell.getValue() ? 'true' : 'false'}</>,
        editSelectOptions: ['true', 'false'],
        muiEditTextFieldProps: {
          select: true,
          error: !!validationErrors?.state,
          helperText: validationErrors?.state,
        },
        size: 100, //decrease the width of this column
      },
      {
        header: 'Created',
        accessorKey: 'created',
        Cell: ({ cell }) => <>{moment(cell.getValue()).format('MM/DD/YYYY, h:mm:ss A')}</>,
        enableEditing: false,
        enableColumnFilter: false,
      },
      {
        header: 'Updated',
        accessorKey: 'updated',
        Cell: ({ cell }) => <>{moment(cell.getValue()).format('MM/DD/YYYY, h:mm:ss A')}</>,
        enableEditing: false,
        enableColumnFilter: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getCommonEditTextFieldProps],
  )

  const reloadUploads = () => {
    setSelectedData([])
    getUploads()
  }

  const getUploads = () => {
    let url = apis.userUploads
    if (props.tableType === 'admin') {
      url = apis.adminUploads
    }
    setLoading(true)

    getData(url)
      .then((data) => {
        let uploads = data.uploads.map((obj) => {
          let rObj = { ...obj }

          if (obj.sharedTo && obj.sharedTo.length > 0) {
            rObj['shared'] = true
          } else {
            rObj['shared'] = false
          }

          return rObj
        })
        setTableData(uploads)
        setLoading(false)
      })
      .catch((err) => {
        setLoading(false)
        alert(err)
      })
  }

  const myUpdateUpload = (uploadedFile, olduploadedFile) => {
    if (props.tableType === 'admin') {
      dispatch(updateUploadAdmin(uploadedFile))
    } else {
      dispatch(updateUpload(uploadedFile))
    }
    return olduploadedFile
  }

  const notifyUpdateResults = () => {
    let resetTable = false
    uploads.forEach((uploadedFile) => {
      const actionTitle = startCase(action) + " upload '" + uploadedFile.name + "'"
      if (errors[uploadedFile.code]) {
        notify('error', actionTitle + ' failed! ' + errors[uploadedFile.code])
      } else {
        notify('success', actionTitle + ' successfully!')
        reloadUploads()
        resetTable = true
      }
    })
    if (resetTable && table) {
      // reset checkboxes
      table.reset()
    }
  }

  const handleAction = (action, rows) => {
    if (action === 'refresh') {
      getUploads()
      return
    }
    if (rows.length === 0) {
      return
    }
    const selectRows = rows.map((row) => {
      return row.original
    })
    setSelectedData(selectRows)
    setOpenDialog(true)
    setAction(action)
  }

  const handleConfirmClose = () => {
    setOpenDialog(false)
  }

  const handleConfirmYes = async () => {
    setOpenDialog(false)
    dispatch(cleanError())
    dispatch(setSubmittingForm(true))
    setUploads([])

    //get user selector options
    if (action === 'share' || action === 'unshare') {
      setOpenUserSelector(true)
    } else if (action === 'export') {
      //do exporting
    } else {
      const promises = selectedData.map(async (uploadedFile) => {
        return proccessUpload(uploadedFile)
      })
      Promise.all(promises).then((results) => {
        setUploads(results)
      })
      //wait for Upload updating complete
      setTimeout(() => {
        dispatch(setSubmittingForm(false))
      }, 500)
    }
  }

  const proccessUpload = (uploadedFile) => {
    if (action === 'delete') {
      uploadedFile.status = 'delete'
    } else if (action === 'publish') {
      uploadedFile.public = true
    } else if (action === 'unpublish') {
      uploadedFile.public = false
    }

    return myUpdateUpload(uploadedFile, uploadedFile)
  }

  const handleUserSelectorChange = (selectedUsers) => {
    setUserlist(
      selectedUsers.map((user) => {
        return user.value
      }),
    )
  }

  const handleUserSelectorYes = async () => {
    setOpenUserSelector(false)
    setOpenDialog(false)
    dispatch(cleanError())
    dispatch(setSubmittingForm(true))
    setUploads([])

    const promises = selectedData.map((uploadedFile) => {
      return processShareUnshareUpload(uploadedFile)
    })
    Promise.all(promises).then((results) => {
      setUploads(results)
    })
    //wait for Upload updating complete
    setTimeout(() => {
      dispatch(setSubmittingForm(false))
    }, 500)
  }

  const processShareUnshareUpload = (uploadedFile) => {
    if (action === 'share') {
      let sharedTo = uploadedFile.sharedTo
      userList.map((user) => {
        if (uploadedFile.owner === user) {
        } else if (!sharedTo.includes(user)) {
          sharedTo.push(user)
        }
        return 1
      })

      uploadedFile.sharedTo = sharedTo
    } else if (action === 'unshare') {
      let sharedTo = uploadedFile.sharedTo
      userList.map((user) => {
        var index = sharedTo.indexOf(user)
        sharedTo.splice(index, 1)
        return 1
      })

      uploadedFile.sharedTo = sharedTo
    }

    return myUpdateUpload(uploadedFile, uploadedFile)
  }

  const handleUserSelectorClose = () => {
    setOpenUserSelector(false)
  }

  return (
    <>
      <ToastContainer />
      <ConfirmDialog
        isOpen={openDialog}
        action={action}
        header={'Are you sure to ' + action + ' the selected uploads?'}
        message={actionDialogs[action].message}
        handleClickYes={handleConfirmYes}
        handleClickClose={handleConfirmClose}
      />
      {openUserSelector && (
        <UserSelector
          type={props.tableType}
          isOpen={openUserSelector}
          action={action}
          onChange={handleUserSelectorChange}
          handleClickYes={handleUserSelectorYes}
          handleClickClose={handleUserSelectorClose}
        />
      )}
      <ThemeProvider theme={theme}>
        <MaterialReactTable
          columns={columns}
          data={tableData}
          enableFullScreenToggle={false}
          enableRowSelection
          enableRowActions
          positionActionsColumn="first"
          enableEditing
          state={{
            isLoading: loading,
          }}
          initialState={{
            columnVisibility: { desc: false, owner: false, created: false },
            sorting: [{ id: 'updated', desc: true }],
          }}
          muiTablePaginationProps={{
            rowsPerPageOptions: [10, 20, 50, 100],
            labelRowsPerPage: 'uploads per page',
          }}
          renderEmptyRowsFallback={() => (
            <center>
              <br></br>No uploads to display
            </center>
          )}
          renderDetailPanel={({ row }) => (
            <div style={{ margin: '15px', textAlign: 'left' }}>
              <b>Description:</b> {row.original.desc}
              {(props.tableType === 'admin' || row.original.owner === user.profile.email) && (
                <>
                  <br></br>
                  <b>Shared To:</b> {row.original.sharedTo.join(', ')}
                </>
              )}
            </div>
          )}
          onEditingRowSave={handleSaveRowEdits}
          onEditingRowCancel={handleCancelRowEdits}
          renderRowActions={({ row, table }) => (
            <Box sx={{ display: 'flex', gap: '1rem' }}>
              <Tooltip arrow placement="bottom" title="Edit">
                <IconButton onClick={() => table.setEditingRow(row)}>
                  <Edit />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          renderTopToolbarCustomActions={({ table }) => {
            return (
              <div>
                <div className="edge-table-title">{props.title}</div>
                <br></br>
                <div className="edge-table-toptoolbar">
                  <Tooltip title="Refresh table" aria-label="refresh">
                    <Fab
                      color="primary"
                      size="small"
                      style={{ marginRight: 10 }}
                      aria-label="refresh"
                    >
                      <Refresh
                        className="edge-table-icon"
                        onClick={() => {
                          handleAction('refresh')
                          table.reset()
                        }}
                      />
                    </Fab>
                  </Tooltip>
                  <Tooltip title="Delete selected uploads" aria-label="delete">
                    <Fab
                      color="primary"
                      size="small"
                      style={{ marginRight: 10 }}
                      aria-label="delete"
                    >
                      <Delete
                        className="edge-table-icon"
                        onClick={() => {
                          setTable(table)
                          handleAction('delete', table.getSelectedRowModel().flatRows)
                        }}
                      />
                    </Fab>
                  </Tooltip>
                  {config.APP.UPLOAD_SHARE_IS_ENABLED && (
                    <>
                      <Tooltip title="Share selected uploads" aria-label="share">
                        <Fab
                          color="primary"
                          size="small"
                          style={{ marginRight: 10 }}
                          aria-label="share"
                        >
                          <PersonAdd
                            className="edge-table-icon"
                            onClick={() => {
                              setTable(table)
                              handleAction('share', table.getSelectedRowModel().flatRows)
                            }}
                          />
                        </Fab>
                      </Tooltip>
                      <Tooltip title="Unshare selected uploads" aria-label="unshare">
                        <Fab
                          color="primary"
                          size="small"
                          style={{ marginRight: 10 }}
                          aria-label="unshare"
                        >
                          <PersonAddDisabled
                            className="edge-table-icon"
                            onClick={() => {
                              handleAction('unshare', table.getSelectedRowModel().flatRows)
                              table.reset()
                            }}
                          />
                        </Fab>
                      </Tooltip>
                      <Tooltip title="Publish selected uploads" aria-label="publish">
                        <Fab
                          color="primary"
                          size="small"
                          style={{ marginRight: 10 }}
                          aria-label="publish"
                        >
                          <LockOpen
                            className="edge-table-icon"
                            onClick={() => {
                              setTable(table)
                              handleAction('publish', table.getSelectedRowModel().flatRows)
                            }}
                          />
                        </Fab>
                      </Tooltip>
                      <Tooltip title="Unpublish selected uploads" aria-label="unpublish">
                        <Fab
                          color="primary"
                          size="small"
                          style={{ marginRight: 10 }}
                          aria-label="unpublish"
                        >
                          <Lock
                            className="edge-table-icon"
                            onClick={() => {
                              setTable(table)
                              handleAction('unpublish', table.getSelectedRowModel().flatRows)
                            }}
                          />
                        </Fab>
                      </Tooltip>
                    </>
                  )}
                </div>
              </div>
            )
          }}
        />
      </ThemeProvider>
    </>
  )
}

export default UploadTable
