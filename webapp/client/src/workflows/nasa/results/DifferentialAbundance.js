/* eslint-disable prettier/prettier */
import React, { useState, useMemo } from 'react'
import { Button, ButtonGroup } from 'reactstrap'
import { MaterialReactTable } from 'material-react-table'
import { ThemeProvider } from '@mui/material'
import { theme } from 'src/edge/um/common/tableUtil'
import { JsonTable } from 'src/edge/common/Tables'
import config from 'src/config'

export const DifferentialAbundance = (props) => {
  const url = config.APP.BASE_URI + '/projects/' + props.project.code + '/'
  const buttons = ['ANCOMBC1', 'ANCOMBC2', 'DESeq2']
  const [selectedButton, setSelectedButton] = useState('ANCOMBC1')
  const [table1Open, setTable1Open] = useState(false)
  const [table2Open, setTable2Open] = useState(false)
  const [table3Open, setTable3Open] = useState(false)
  const tableData1 = props.result[buttons[0]]['Differential Abundance']
  const tableData2 = props.result[buttons[1]]['Differential Abundance']
  const tableData3 = props.result[buttons[2]]['Differential Abundance']
  //create columns from data
  const columns1 = useMemo(
    () =>
      tableData1.length
        ? Object.keys(tableData1[0]).map((columnId) => ({
          header: columnId,
          accessorKey: columnId,
          id: columnId,
        }))
        : [],
    [tableData1],
  )
  const columns2 = useMemo(
    () =>
      tableData2.length
        ? Object.keys(tableData2[0]).map((columnId) => ({
          header: columnId,
          accessorKey: columnId,
          id: columnId,
        }))
        : [],
    [tableData2],
  )
  const columns3 = useMemo(
    () =>
      tableData3.length
        ? Object.keys(tableData3[0]).map((columnId) => ({
          header: columnId,
          accessorKey: columnId,
          id: columnId,
        }))
        : [],
    [tableData3],
  )

  return (
    <>
      <ButtonGroup className="mr-3" aria-label="First group" size="sm">
        {buttons.map((item, index) => (
          <Button
            key={`taxonomy-${index}`}
            color="outline-primary"
            onClick={() => {
              setSelectedButton(item)
            }}
            active={selectedButton === item}
          >
            {item}
          </Button>
        ))}
      </ButtonGroup>
      <br></br>
      <br></br>
      {selectedButton === 'ANCOMBC1' && (
        <>
          A description of each of the following ANCOMBC1 differential abundance output files can be
          found in the “Output Data” section of{' '}
          <a
            href="https://github.com/nasa/GeneLab_Data_Processing/tree/master/Amplicon/Illumina/Pipeline_GL-DPPD-7104_Versions/GL-DPPD-7104-C.md#10a-ancombc-1"
            target="_blank"
            rel="noopener noreferrer"
          >
            Step 10a, “ANCOMBC1”
          </a>
          , of the GeneLab Amplicon Sequencing Pipeline document on GitHub.
        </>
      )}
      {selectedButton === 'ANCOMBC2' && (
        <>
          A description of each of the following ANCOMBC2 differential abundance output files can be
          found in the “Output Data” section of{' '}
          <a
            href="https://github.com/nasa/GeneLab_Data_Processing/tree/master/Amplicon/Illumina/Pipeline_GL-DPPD-7104_Versions/GL-DPPD-7104-C.md#10b-ancombc-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            Step 10b , “ANCOMBC2”
          </a>
          , of the GeneLab Amplicon Sequencing Pipeline document on GitHub.
        </>
      )}
      {selectedButton === 'DESeq2' && (
        <>
          A description of each of the following DESeq2 differential abundance output files can be
          found in the “Output Data” section of{' '}
          <a
            href="https://github.com/nasa/GeneLab_Data_Processing/tree/master/Amplicon/Illumina/Pipeline_GL-DPPD-7104_Versions/GL-DPPD-7104-C.md#10c-deseq2"
            target="_blank"
            rel="noopener noreferrer"
          >
            Step 10c, “DESeq2”
          </a>
          , of the GeneLab Amplicon Sequencing Pipeline document on GitHub.
        </>
      )}
      <br></br>
      <br></br>
      {props.result[selectedButton] ? (
        props.result[selectedButton]['plots'].map((html, id) => (
          <span key={id} title="Click to view the image in full screen">
            <a href={url + html} target="_blank" rel="noreferrer">
              <img src={url + html} alt={html} width="50%" height="50%"></img>
            </a>
          </span>
        ))
      ) : (
        <span>
          No plots available
          <br></br>
          <br></br>
        </span>
      )}
      <br></br>
      <br></br>
      <span className="edge-link-large" onClick={() => setTable1Open(!table1Open)}>
        Sample Info
      </span>
      {table1Open && (
        <>
          {props.result[selectedButton]['Sample Info'] ? (
            <JsonTable
              data={props.result[selectedButton]['Sample Info']}
              headers={Object.keys(props.result[selectedButton]['Sample Info'][0])}
            />
          ) : (
            <span>
              <br></br>
              Empty table
            </span>
          )}
        </>
      )}
      <br></br>
      <span className="edge-link-large" onClick={() => setTable2Open(!table2Open)}>
        Pairwise Contrasts
      </span>
      {table2Open && (
        <>
          {props.result[selectedButton]['Pairwise Contrasts'] ? (
            <JsonTable
              data={props.result[selectedButton]['Pairwise Contrasts']}
              headers={Object.keys(props.result[selectedButton]['Pairwise Contrasts'][0])}
            />
          ) : (
            <span>
              <br></br>
              Empty table
            </span>
          )}
        </>
      )}
      <br></br>
      <span className="edge-link-large" onClick={() => setTable3Open(!table3Open)}>
        Differential Abundance
      </span>
      {table3Open && (
        <>
          {selectedButton === buttons[0] && (
            <>
              <ThemeProvider theme={theme}>
                <MaterialReactTable
                  key={buttons[0]}
                  columns={columns1}
                  data={tableData1}
                  enableFullScreenToggle={false}
                  muiTablePaginationProps={{
                    rowsPerPageOptions: [10, 20, 50, 100],
                    labelRowsPerPage: 'rows per page',
                  }}
                  renderEmptyRowsFallback={() => (
                    <center>
                      <br></br>No result to display
                    </center>
                  )}
                />
              </ThemeProvider>
            </>
          )}
          {selectedButton === buttons[1] && (
            <>
              <ThemeProvider theme={theme}>
                <MaterialReactTable
                  key={buttons[1]}
                  columns={columns2}
                  data={tableData2}
                  enableFullScreenToggle={false}
                  muiTablePaginationProps={{
                    rowsPerPageOptions: [10, 20, 50, 100],
                    labelRowsPerPage: 'rows per page',
                  }}
                  renderEmptyRowsFallback={() => (
                    <center>
                      <br></br>No result to display
                    </center>
                  )}
                />
              </ThemeProvider>
            </>
          )}
          {selectedButton === buttons[2] && (
            <>
              <ThemeProvider theme={theme}>
                <MaterialReactTable
                  key={buttons[2]}
                  columns={columns3}
                  data={tableData3}
                  enableFullScreenToggle={false}
                  muiTablePaginationProps={{
                    rowsPerPageOptions: [10, 20, 50, 100],
                    labelRowsPerPage: 'rows per page',
                  }}
                  renderEmptyRowsFallback={() => (
                    <center>
                      <br></br>No result to display
                    </center>
                  )}
                />
              </ThemeProvider>
            </>
          )}
        </>
      )}
      <br></br>
    </>
  )
}
