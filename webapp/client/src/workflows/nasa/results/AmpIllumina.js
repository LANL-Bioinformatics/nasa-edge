/* eslint-disable prettier/prettier */
import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardBody, Collapse, TabContent, TabPane, Nav, NavItem, NavLink } from 'reactstrap'
import { MaterialReactTable } from 'material-react-table'
import { ThemeProvider } from '@mui/material'
import { theme } from 'src/edge/um/common/tableUtil'
import { Header } from 'src/edge/project/results/CardHeader'
import { AlphaDiversity } from './AlphaDiversity'
import { BetaDiversity } from './BetaDiversity'
import { Taxonomy } from './Taxonomy'
import { DifferentialAbundance } from './DifferentialAbundance'

export const AmpIllumina = (props) => {
  const [collapseCard, setCollapseCard] = useState(true)
  const tabs = {
    'Alpha Diversity': 'alpha_diversity',
    'Beta Diversity': 'beta_diversity',
    Taxonomy: 'taxonomy',
    'Differential Abundance': 'differential_abundance',
  }
  const [activeTab, setActiveTab] = useState(0)
  const tableData = props.result['Read Count Tracking']
  //create columns from data
  const columns = useMemo(
    () =>
      tableData.length
        ? Object.keys(tableData[0]).map((columnId) => ({
          header: columnId,
          accessorKey: columnId,
          id: columnId,
        }))
        : [],
    [tableData],
  )
  const tableData2 = props.result['Taxonomy and Counts']
  //create columns from data
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

  const toggleTab = (tab) => {
    setActiveTab(tab)
  }

  useEffect(() => {
    if (props.allExpand > 0) {
      setCollapseCard(false)
    }
  }, [props.allExpand])

  useEffect(() => {
    if (props.allClosed > 0) {
      setCollapseCard(true)
    }
  }, [props.allClosed])

  return (
    <Card className="workflow-result-card">
      <Header
        toggle={true}
        toggleParms={() => {
          setCollapseCard(!collapseCard)
        }}
        title={'AmpIllumina Result'}
        collapseParms={collapseCard}
      />
      <Collapse isOpen={!collapseCard}>
        <CardBody>
          <Nav tabs>
            {Object.keys(tabs).map((tool, index) => (
              <NavItem key={tool + index}>
                <NavLink
                  style={{ cursor: 'pointer' }}
                  active={activeTab === index}
                  onClick={() => {
                    toggleTab(index)
                  }}
                >
                  {tool}
                </NavLink>
              </NavItem>
            ))}
          </Nav>
          <TabContent activeTab={activeTab}>
            {Object.keys(tabs).map((tool, index) => (
              <TabPane key={index} tabId={index}>
                <br></br>
                {tool === 'Alpha Diversity' ? (
                  <AlphaDiversity project={props.project} result={props.result[tabs[tool]]} />
                ) : tool === 'Beta Diversity' ? (
                  <BetaDiversity project={props.project} result={props.result[tabs[tool]]} />
                ) : tool === 'Taxonomy' ? (
                  <Taxonomy project={props.project} result={props.result[tabs[tool]]} />
                ) : tool === 'Differential Abundance' ? (
                  <DifferentialAbundance
                    project={props.project}
                    result={props.result[tabs[tool]]}
                  />
                ) : (
                  <span>
                    No plots available
                    <br></br>
                    <br></br>
                  </span>
                )}
              </TabPane>
            ))}
          </TabContent>
          <br></br>
          <br></br>
          {tableData && (
            <>
              <ThemeProvider theme={theme}>
                <MaterialReactTable
                  columns={columns}
                  data={tableData}
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
                  renderTopToolbarCustomActions={({ table }) => {
                    return (
                      <div>
                        <div style={{ fontSize: '24px' }}>{'Read Count Tracking'}</div>
                      </div>
                    )
                  }}
                />
              </ThemeProvider>
            </>
          )}
          <br></br>
          <br></br>
          {tableData2 && (
            <>
              <ThemeProvider theme={theme}>
                <MaterialReactTable
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
                  renderTopToolbarCustomActions={({ table }) => {
                    return (
                      <div>
                        <div style={{ fontSize: '24px' }}>{'Taxonomy and Counts'}</div>
                      </div>
                    )
                  }}
                />
              </ThemeProvider>
            </>
          )}
          <br></br>
        </CardBody>
      </Collapse>
    </Card>
  )
}
