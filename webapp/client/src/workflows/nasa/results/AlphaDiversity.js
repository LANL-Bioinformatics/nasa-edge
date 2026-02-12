import React, { useState, useEffect } from 'react'
import { JsonTable } from 'src/edge/common/Tables'
import config from 'src/config'

export const AlphaDiversity = (props) => {
  const url = config.APP.BASE_URI + '/projects/' + props.project.code + '/'
  const [table1Open, setTable1Open] = useState(false)
  const [table2Open, setTable2Open] = useState(false)

  return (
    <>
      A description of each of the following alpha diversity output files can be found in the
      “Output Data” sections of{' '}
      <a
        href="https://github.com/nasa/GeneLab_Data_Processing/blob/master/Amplicon/Illumina/Pipeline_GL-DPPD-7104_Versions/GL-DPPD-7104-C.md#7-alpha-diversity-analysis"
        target="_blank"
        rel="noopener noreferrer"
      >
        Step 7, “Alpha Diversity Analysis”
      </a>
      , of the GeneLab Amplicon Sequencing Pipeline document on GitHub.
      <br></br>
      <br></br>
      {props.result ? (
        props.result['plots'].map((html, id) => (
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
        Metric Statistics
      </span>
      {table1Open && (
        <>
          {props.result['statistics'] ? (
            <JsonTable
              data={props.result['statistics']}
              headers={Object.keys(props.result['statistics'][0])}
            />
          ) : (
            <span>
              <br></br>
              Empty table
            </span>
          )}
          <br></br>
        </>
      )}
      <br></br>
      <span className="edge-link-large" onClick={() => setTable2Open(!table2Open)}>
        Metric Summary
      </span>
      {table2Open && (
        <>
          {props.result['summary'] ? (
            <JsonTable
              data={props.result['summary']}
              headers={Object.keys(props.result['summary'][0])}
            />
          ) : (
            <span>
              <br></br>
              Empty table
            </span>
          )}
          <br></br>
        </>
      )}
    </>
  )
}
