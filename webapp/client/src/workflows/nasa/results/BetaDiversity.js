import React, { useState, useEffect } from 'react'
import { Button, ButtonGroup } from 'reactstrap'
import { JsonTable } from 'src/edge/common/Tables'
import config from 'src/config'

export const BetaDiversity = (props) => {
  const url = config.APP.BASE_URI + '/projects/' + props.project.code + '/'
  const [selectedButton, setSelectedButton] = useState('Bray-Curtis dissimilarity')
  const [table1Open, setTable1Open] = useState(false)
  const [table2Open, setTable2Open] = useState(false)

  return (
    <>
      A description of each of the following beta diversity output files can be found in the “Output
      Data” sections of{' '}
      <a
        href="https://github.com/nasa/GeneLab_Data_Processing/tree/master/Amplicon/Illumina/Pipeline_GL-DPPD-7104_Versions/GL-DPPD-7104-C.md#8-beta-diversity-analysis"
        target="_blank"
        rel="noopener noreferrer"
      >
        Step 8, “Beta Diversity Analysis”
      </a>
      , of the GeneLab Amplicon Sequencing Pipeline document on GitHub.
      <br></br>
      <br></br>
      <ButtonGroup className="mr-3" aria-label="First group" size="sm">
        <Button
          key={'beta-1'}
          color="outline-primary"
          onClick={() => {
            setSelectedButton('Bray-Curtis dissimilarity')
          }}
          active={selectedButton === 'Bray-Curtis dissimilarity'}
        >
          {'Bray-Curtis dissimilarity'}
        </Button>
        <Button
          key={'beta-2'}
          color="outline-primary"
          onClick={() => {
            setSelectedButton('Euclidean distance')
          }}
          active={selectedButton === 'Euclidean distance'}
        >
          {'Euclidean distance'}
        </Button>
      </ButtonGroup>
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
        Adonis Statistics
      </span>
      {table1Open && (
        <>
          {props.result[selectedButton]['adonis statistics'] ? (
            <JsonTable
              data={props.result[selectedButton]['adonis statistics']}
              headers={Object.keys(props.result[selectedButton]['adonis statistics'][0])}
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
        Variance Statistics
      </span>
      {table2Open && (
        <>
          {props.result[selectedButton]['variance statistics'] ? (
            <JsonTable
              data={props.result[selectedButton]['variance statistics']}
              headers={Object.keys(props.result[selectedButton]['variance statistics'][0])}
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
    </>
  )
}
