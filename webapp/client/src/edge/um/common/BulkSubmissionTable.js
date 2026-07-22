import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Badge } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { updateBulkSubmission } from 'src/redux/reducers/edge/userSlice'
import { updateBulkSubmissionAdmin } from 'src/redux/reducers/edge/adminSlice'
import { setSubmittingForm } from 'src/redux/reducers/pageSlice'
import { cleanError } from 'src/redux/reducers/messageSlice'
import { workflowList } from 'src/util'
import { ConfirmDialog } from '../../common/Dialogs'
import { notify, getData, apis, isValidProjectName } from '../../common/util'
import {
  theme,
  bulkSubmissionStatusColors,
  bulkSubmissionStatusNames,
  validateRequired,
  validateBoolean,
} from './tableUtil'
import UserSelector from './UserSelector'
import startCase from 'lodash.startcase'

import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { MaterialReactTable } from 'material-react-table'
import { ThemeProvider, Box, IconButton, Tooltip } from '@mui/material'
import Fab from '@mui/material/Fab'
import {
  Delete,
  Edit,
  Redo,
  Refresh,
  PersonAdd,
  PersonAddDisabled,
  Lock,
  LockOpen,
  Explore,
} from '@mui/icons-material'
import dayjs from 'dayjs'

const actionDialogs = {
  '': { message: 'This action is not undoable.' },
  update: { message: 'This action is not undoable.' },
  rerun: { message: 'This action is not undoable.' },
  delete: { message: 'This action is not undoable.' },
  share: { message: "You can use 'unshare' to undo this action." },
  unshare: { message: "You can use 'share' to undo this action." },
  publish: { message: "You can use 'unpublish' to undo this action." },
  unpublish: { message: "You can use 'publish' to undo this action." },
  export: { message: 'Export metadata of the selected bulkSubmissions to a csv file.' },
}

const BulkSubmissionTable = (props) => {
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
  const [bulkSubmissions, setBulkSubmissions] = useState()
  const [validationErrors, setValidationErrors] = useState({})
  const [bulkSubmissionPageUrl, setBulkSubmissionPageUrl] = useState('/user/bulksubmission?code=')

  useEffect(() => {
    if (props.tableType === 'admin' && user.profile.role !== 'admin') {
      navigate('/home')
    } else {
      if (props.tableType === 'admin') {
        setBulkSubmissionPageUrl('/admin/bulksubmission?code=')
      }
      getBulkSubmissions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, user])

  useEffect(() => {
    if (bulkSubmissions && !page.submittingForm) {
      notifyUpdateResults()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkSubmissions, page])

  const handleSaveRowEdits = async ({ exitEditingMode, row, values }) => {
    if (!Object.keys(validationErrors).length) {
      const oldData = row.original
      let newData = { ...oldData, name: values.name, desc: values.desc }
      let update = new Promise((resolve, reject) => {
        setOpenDialog(false)
        dispatch(cleanError())
        dispatch(setSubmittingForm(true))
        setBulkSubmissions([])
        setAction('update')
        const bulkSubmission = updateBulk(newData, oldData)
        setBulkSubmissions([bulkSubmission])
        resolve(bulkSubmission)
        //wait for bulkSubmission updating complete
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
          } else if (cell.column.id === 'name') {
            isValid = isValidProjectName(event.target.value)
          }

          if (!isValid) {
            //set validation error for cell if invalid
            if (cell.column.id === 'public') {
              setValidationErrors({
                ...validationErrors,
                [cell.id]: `${cell.column.columnDef.header} is required. Valid values: true, false`,
              })
            } else if (cell.column.id === 'name') {
              setValidationErrors({
                ...validationErrors,
                [cell.id]: `${cell.column.columnDef.header} is required, at 3 but less than 30 characters. Only alphabets, numbers, dashs, dot and underscore are allowed in the name.`,
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
        header: 'Name',
        accessorKey: 'name',
        muiTableBodyCellEditTextFieldProps: ({ cell }) => ({
          ...getCommonEditTextFieldProps(cell),
        }),
      },
      { header: 'Description', accessorKey: 'desc' },
      {
        header: 'Owner',
        accessorKey: 'owner',
        enableEditing: false,
      },
      {
        accessorFn: (originalRow) => workflowList[originalRow.type].label, // Use accessorFn to create the display string for filtering
        header: 'Type',
        accessorKey: 'type',
        enableEditing: false,
      },
      {
        header: 'File',
        accessorKey: 'filename',
        enableEditing: false,
      },
      {
        header: 'Status',
        accessorKey: 'status',
        Cell: ({ cell }) => (
          <Badge color={bulkSubmissionStatusColors[cell.getValue()]}>
            {bulkSubmissionStatusNames[cell.getValue()]}
          </Badge>
        ),
        enableEditing: false,
        size: 100, //decrease the width of this column
      },
      {
        header: 'Created',
        accessorKey: 'created',
        Cell: ({ cell }) => <>{dayjs(cell.getValue()).format('MM/DD/YYYY, h:mm:ss A')}</>,
        enableEditing: false,
        enableColumnFilter: false,
      },
      {
        header: 'Updated',
        accessorKey: 'updated',
        Cell: ({ cell }) => <>{dayjs(cell.getValue()).format('MM/DD/YYYY, h:mm:ss A')}</>,
        enableEditing: false,
        enableColumnFilter: false,
      },
    ],

    [getCommonEditTextFieldProps],
  )

  const reloadBulkSubmissions = () => {
    setSelectedData([])
    getBulkSubmissions()
  }

  const getBulkSubmissions = () => {
    let url = apis.userBulkSubmissions
    if (props.tableType === 'admin') {
      url = apis.adminBulkSubmissions
    }
    setLoading(true)
    getData(url)
      .then((data) => {
        let bulks = data.bulkSubmissions.map((obj) => {
          let rObj = { ...obj }

          if (obj.sharedTo && obj.sharedTo.length > 0) {
            rObj['shared'] = true
          } else {
            rObj['shared'] = false
          }

          return rObj
        })
        setLoading(false)
        setTableData(bulks)
      })
      .catch((err) => {
        setLoading(false)
        alert(err)
      })
  }

  const updateBulk = (bulk, oldBulk) => {
    // only update status to 'rerun' if it is 'failed'
    const stats = ['failed', 'processing']
    if (action === 'rerun' && !stats.includes(oldBulk.status)) {
      return oldBulk
    }
    if (props.tableType === 'admin') {
      dispatch(updateBulkSubmissionAdmin(bulk))
    } else {
      dispatch(updateBulkSubmission(bulk))
    }
    return oldBulk
  }

  const notifyUpdateResults = () => {
    let resetTable = false
    bulkSubmissions.forEach((bulk) => {
      const actionTitle = startCase(action) + " bulk submission '" + bulk.name + "'"
      if (errors[bulk.code]) {
        notify('error', actionTitle + ' failed! ' + errors[bulk.code])
      } else {
        notify('success', actionTitle + ' successfully!')
        reloadBulkSubmissions()
        resetTable = true
      }
    })
    if (resetTable && table) {
      table.reset()
    }
  }

  const handleAction = (action, rows) => {
    if (action === 'refresh') {
      getBulkSubmissions()
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
    setBulkSubmissions([])

    //get user selector options
    if (action === 'share' || action === 'unshare') {
      setOpenUserSelector(true)
    } else if (action === 'export') {
      //do exporting
    } else {
      const promises = selectedData.map(async (bulk) => {
        return proccessBulkSubmission(bulk)
      })
      Promise.all(promises).then((results) => {
        setBulkSubmissions(results)
      })
      //wait for bulk submission updating complete
      setTimeout(() => {
        dispatch(setSubmittingForm(false))
      }, 500)
    }
  }

  const proccessBulkSubmission = (bulk) => {
    const oldBulk = { ...bulk }
    if (action === 'delete') {
      bulk.status = 'delete'
    } else if (action === 'rerun') {
      bulk.status = 'rerun'
    } else if (action === 'publish') {
      bulk.public = true
    } else if (action === 'unpublish') {
      bulk.public = false
    }

    return updateBulk(bulk, oldBulk)
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
    setBulkSubmissions([])

    const promises = selectedData.map((bulk) => {
      return processShareUnshareBulkSubmission(bulk)
    })
    Promise.all(promises).then((results) => {
      setBulkSubmissions(results)
    })
    //wait for bulkSubmission updating complete
    setTimeout(() => {
      dispatch(setSubmittingForm(false))
    }, 500)
  }

  const processShareUnshareBulkSubmission = (bulk) => {
    const oldBulk = { ...bulk }
    if (action === 'share') {
      let sharedTo = bulk.sharedTo
      userList.map((user) => {
        if (bulk.owner === user) {
        } else if (!sharedTo.includes(user)) {
          sharedTo.push(user)
        }
        return 1
      })

      bulk.sharedTo = sharedTo
    } else if (action === 'unshare') {
      let sharedTo = bulk.sharedTo
      userList.map((user) => {
        var index = sharedTo.indexOf(user)
        sharedTo.splice(index, 1)
        return 1
      })

      bulk.sharedTo = sharedTo
    }

    return updateBulk(bulk, oldBulk)
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
        header={'Are you sure to ' + action + ' the selected bulk submissions?'}
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
            labelRowsPerPage: 'bulk submissions per page',
          }}
          renderEmptyRowsFallback={() => (
            <center>
              <br></br>No bulk submissions to display
            </center>
          )}
          renderDetailPanel={({ row }) => (
            <div style={{ margin: '15px', textAlign: 'left' }}>
              <b>Description:</b> {row.original.desc}
            </div>
          )}
          onEditingRowSave={handleSaveRowEdits}
          onEditingRowCancel={handleCancelRowEdits}
          renderRowActions={({ row, table }) => (
            <Box sx={{ display: 'flex', gap: '1rem' }}>
              <Tooltip arrow placement="bottom" title="Go to bulk submission result page">
                <IconButton
                  onClick={() => navigate(`${bulkSubmissionPageUrl}${row.original.code}`)}
                >
                  <Explore />
                </IconButton>
              </Tooltip>
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
                  <Tooltip title="Delete selected bulkSubmissions" aria-label="delete">
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
                  {props.tableType === 'admin' && (
                    <Tooltip title="Rerun selected 'Failed' bulkSubmissions" aria-label="rerun">
                      <Fab
                        color="primary"
                        size="small"
                        style={{ marginRight: 10 }}
                        aria-label="rerun"
                      >
                        <Redo
                          className="edge-table-icon"
                          onClick={() => {
                            setTable(table)
                            handleAction('rerun', table.getSelectedRowModel().flatRows)
                          }}
                        />
                      </Fab>
                    </Tooltip>
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

export default BulkSubmissionTable
