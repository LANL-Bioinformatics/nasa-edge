import React, { useState, useEffect, useMemo } from 'react'
import dayjs from 'dayjs'
import { MaterialReactTable } from 'material-react-table'
import { Badge } from 'reactstrap'
import { ThemeProvider } from '@mui/material'
import { theme, projectStatusColors, projectStatusNames } from '../common/tableUtil'
import { getData, apis } from '../../common/util'
import { workflowList } from 'src/util'

const JobQueue = () => {
  //should be memoized or stable
  const columns = useMemo(
    () => [
      {
        accessorKey: 'name', //access nested data with dot notation
        header: 'project',
      },
      {
        accessorFn: (originalRow) => workflowList[originalRow.type].label, // Use accessorFn to create the display string for filtering
        accessorKey: 'type', //normal accessorKey
        header: 'Type',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        Cell: ({ cell }) => (
          <Badge color={projectStatusColors[cell.getValue()]}>
            {projectStatusNames[cell.getValue()]}
          </Badge>
        ),
        size: 100, //decrease the width of this column
      },
      {
        accessorKey: 'created',
        header: 'Created',
        Cell: ({ cell }) => <>{dayjs(cell.getValue()).format('MM/DD/YYYY, h:mm:ss A')}</>,
      },
      {
        accessorKey: 'updated',
        header: 'Updated',
        Cell: ({ cell }) => <>{dayjs(cell.getValue()).format('MM/DD/YYYY, h:mm:ss A')}</>,
      },
    ],
    [],
  )

  const [tableData, setTableData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const getProjects = () => {
      setLoading(true)
      getData(apis.jobQueue)
        .then((data) => {
          setTableData(data.projects)
          setLoading(false)
        })
        .catch((err) => {
          setLoading(false)
          alert(err)
        })
    }
    //refresh table every 30 seconds
    getProjects()
    const timer = setInterval(() => {
      getProjects()
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <MaterialReactTable
        columns={columns}
        data={tableData}
        enableFullScreenToggle={false}
        enableColumnActions={false}
        enableSorting={true}
        enableColumnFilters={true}
        state={{
          isLoading: loading,
        }}
        renderEmptyRowsFallback={() => (
          <center>
            <br></br>No jobs to display
          </center>
        )}
        renderTopToolbarCustomActions={({ table }) => {
          return <div className="edge-table-title">Job Queue</div>
        }}
      />
    </ThemeProvider>
  )
}

export default JobQueue
