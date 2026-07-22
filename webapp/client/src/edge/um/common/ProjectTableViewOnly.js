import React, { useState, useEffect, useMemo } from 'react'
import { Badge } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { MaterialReactTable } from 'material-react-table'
import { ThemeProvider, Box, IconButton, Tooltip } from '@mui/material'
import Fab from '@mui/material/Fab'
import { Refresh, Explore } from '@mui/icons-material'
import dayjs from 'dayjs'
import { theme, projectStatusColors, projectStatusNames } from '../common/tableUtil'
import { getData } from '../../common/util'
import { workflowList } from 'src/util'

const ProjectTableViewOnly = (props) => {
  const navigate = useNavigate()
  const [tableData, setTableData] = useState([])
  const [loading, setLoading] = useState(false)

  //should be memoized or stable
  const columns = useMemo(
    () => [
      {
        header: 'Project',
        accessorKey: 'name',
      },
      { header: 'Description', accessorKey: 'desc' },
      {
        accessorFn: (originalRow) => workflowList[originalRow.type].label, // Use accessorFn to create the display string for filtering
        header: 'Type',
        accessorKey: 'type',
        enableEditing: false,
      },
      {
        header: 'Status',
        accessorKey: 'status',
        Cell: ({ cell }) => (
          <Badge color={projectStatusColors[cell.getValue()]}>
            {projectStatusNames[cell.getValue()]}
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
    [],
  )

  const getProjects = () => {
    setLoading(true)
    getData(props.api)
      .then((data) => {
        setTableData(data.projects)
        setLoading(false)
      })
      .catch((err) => {
        setLoading(false)
        alert(err)
      })
  }

  useEffect(() => {
    getProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <MaterialReactTable
        columns={columns}
        data={tableData}
        enableFullScreenToggle={false}
        enableRowActions
        positionActionsColumn="first"
        state={{
          isLoading: loading,
        }}
        initialState={{
          columnVisibility: { desc: false },
          sorting: [{ id: 'updated', desc: true }],
        }}
        muiTablePaginationProps={{
          rowsPerPageOptions: [10, 20, 50, 100],
          labelRowsPerPage: 'projects per page',
        }}
        renderEmptyRowsFallback={() => (
          <center>
            <br></br>No projects to display
          </center>
        )}
        renderRowActions={({ row, table }) => (
          <Box sx={{ display: 'flex', gap: '1rem' }}>
            <Tooltip arrow placement="bottom" title="Go to project result page">
              <IconButton onClick={() => navigate(`${props.projectPageUrl}${row.original.code}`)}>
                <Explore />
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
                        getProjects()
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
  )
}

export default ProjectTableViewOnly
