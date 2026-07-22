import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Badge } from 'reactstrap'
import { useDispatch, useSelector } from 'react-redux'
import { MaterialReactTable } from 'material-react-table'
import { ThemeProvider, Box, IconButton, Tooltip } from '@mui/material'
import Fab from '@mui/material/Fab'
import { Edit, Refresh, Delete } from '@mui/icons-material'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { updateUserAdmin, deleteUserAdmin } from '../../../redux/reducers/edge/adminSlice'
import {
  theme,
  userTypeColors,
  userTypeNames,
  userStatusColors,
  userStatusNames,
  validateRequired,
  validateBoolean,
  validatePassword,
  validateRole,
} from '../common/tableUtil'
import { notify, getData, apis } from '../../common/util'

const UserTable = (props) => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const user = useSelector((state) => state.user)
  const errors = useSelector((state) => state.message.errors)
  const page = useSelector((state) => state.page)

  const [tableData, setTableData] = useState([])
  const [selectedUser, setSelectedUser] = useState()
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})

  useEffect(() => {
    if (user.profile.role !== 'admin') {
      navigate('/home')
    } else {
      getUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, user])

  useEffect(() => {
    if (selectedUser && !page.submittingForm) {
      setTimeout(() => afterActionSubmit(action, selectedUser.email), 500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, page, action])

  const afterActionSubmit = (action, user) => {
    if (errors[action]) {
      notify('error', `Failed to ${action} user ${user}: ${errors[action]}`)
    } else {
      notify('success', `${action} user ${user} successfully!`)
      getUsers()
    }
  }

  const handleDeleteRow = useCallback((row) => {
    if (!confirm(`Are you sure you want to delete ${row.getValue('email')}`)) {
      return
    }
    let promise = new Promise((resolve, reject) => {
      setAction('delete')
      setSelectedUser()
      dispatch(deleteUserAdmin(row.original))
      resolve(row.original)
    })
    promise.then((newUser) => {
      setSelectedUser(newUser)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveRowEdits = async ({ exitEditingMode, row, values }) => {
    if (!Object.keys(validationErrors).length) {
      const oldData = row.original
      let newData = {
        email: oldData.email,
        firstName: values.firstName,
        lastName: values.lastName,
        role: values.role,
        active: values.active,
      }
      if (values.newPassword) {
        newData.password = values.newPassword
        newData.confirmPassword = values.newPassword
      }

      let update = new Promise((resolve, reject) => {
        setAction('update')
        setSelectedUser()
        dispatch(updateUserAdmin(newData))
        resolve(newData)
        //wait for updating complete
        setTimeout(() => {
          getUsers()
        }, 200)
      })
      update.then((newUser) => {
        setSelectedUser(newUser)
      })
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
          if (cell.column.id === 'active') {
            isValid = validateBoolean(event.target.value)
          } else if (cell.column.id === 'role') {
            isValid = validateRole(event.target.value)
          } else if (cell.column.id === 'newPassword') {
            isValid = validatePassword(event.target.value)
          }
          if (!isValid) {
            //set validation error for cell if invalid
            if (cell.column.id === 'active') {
              setValidationErrors({
                ...validationErrors,
                [cell.id]: `${cell.column.columnDef.header} is required. Valid values: true, false`,
              })
            } else if (cell.column.id === 'role') {
              setValidationErrors({
                ...validationErrors,
                [cell.id]: `${cell.column.columnDef.header} is required. Valid values: admin, user`,
              })
            } else if (cell.column.id === 'newPassword') {
              setValidationErrors({
                ...validationErrors,
                [cell.id]: `${cell.column.columnDef.header} is optional. The password has to meet all the requirements:at least one lowercase letter,one uppercase letter,one digit , one special character, and is at least eight characters long`,
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
        header: 'First Name',
        accessorKey: 'firstName',
        muiTableBodyCellEditTextFieldProps: ({ cell }) => ({
          ...getCommonEditTextFieldProps(cell),
        }),
      },
      {
        header: 'Last Name',
        accessorKey: 'lastName',
        muiTableBodyCellEditTextFieldProps: ({ cell }) => ({
          ...getCommonEditTextFieldProps(cell),
        }),
      },
      { header: 'Email', accessorKey: 'email', enableEditing: false },
      {
        header: 'Password',
        accessorKey: 'newPassword',
        enableHiding: true,
        muiTableBodyCellEditTextFieldProps: ({ cell }) => ({
          ...getCommonEditTextFieldProps(cell),
        }),
      },
      {
        header: 'Role',
        accessorKey: 'role',
        Cell: ({ cell }) => (
          <Badge color={userTypeColors[cell.getValue()]}>{userTypeNames[cell.getValue()]}</Badge>
        ),
        editSelectOptions: ['admin', 'user'],
        muiEditTextFieldProps: {
          select: true,
          error: !!validationErrors?.state,
          helperText: validationErrors?.state,
        },
        size: 100, //decrease the width of this column
      },
      {
        header: 'Active',
        accessorKey: 'active',
        Cell: ({ cell }) => (
          <Badge color={userStatusColors[cell.getValue()]}>
            {userStatusNames[cell.getValue()]}
          </Badge>
        ),
        editSelectOptions: ['true', 'false'],
        muiEditTextFieldProps: {
          select: true,
          error: !!validationErrors?.state,
          helperText: validationErrors?.state,
        },
        enableColumnFilter: false,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getCommonEditTextFieldProps],
  )

  const getUsers = () => {
    setLoading(true)
    getData(apis.adminUsers)
      .then((data) => {
        let users = data.users.map((obj) => {
          //console.log(obj)
          let rObj = { ...obj, newPassword: '' }
          return rObj
        })

        setTableData(users)
        setLoading(false)
      })
      .catch((err) => {
        setLoading(false)
        alert(err)
      })
  }

  return (
    <>
      <ToastContainer />
      <ThemeProvider theme={theme}>
        <MaterialReactTable
          columns={columns}
          data={tableData}
          enableFullScreenToggle={false}
          enableRowSelection={false}
          enableRowActions
          positionActionsColumn="first"
          enableEditing
          state={{
            isLoading: loading,
          }}
          initialState={{
            columnVisibility: { newPassword: false, created: false },
            sorting: [{ id: 'updated', desc: true }],
          }}
          muiTablePaginationProps={{
            rowsPerPageOptions: [10, 20, 50, 100],
            labelRowsPerPage: 'users per page',
          }}
          editingMode="modal"
          onEditingRowSave={handleSaveRowEdits}
          onEditingRowCancel={handleCancelRowEdits}
          renderRowActions={({ row, table }) => (
            <Box sx={{ display: 'flex', gap: '1rem' }}>
              <Tooltip arrow placement="bottom" title="Edit">
                <IconButton onClick={() => table.setEditingRow(row)}>
                  <Edit />
                </IconButton>
              </Tooltip>
              <Tooltip arrow placement="bottom" title="Delete">
                <IconButton onClick={() => handleDeleteRow(row)}>
                  <Delete />
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
                          getUsers()
                          table.reset()
                        }}
                      />
                    </Fab>
                  </Tooltip>
                </div>
              </div>
            )
          }}
        />
      </ThemeProvider>
    </>
  )
}

export default UserTable
