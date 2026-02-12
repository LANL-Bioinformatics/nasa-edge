import React, { useState, useEffect } from 'react'
import { Button, ButtonGroup } from 'reactstrap'
import config from 'src/config'

export const Taxonomy = (props) => {
  const url = config.APP.BASE_URI + '/projects/' + props.project.code + '/'
  const buttons = ['by Phylum', 'by Class', 'by Order', 'by Family', 'by Genus', 'by Species']
  const [selectedButton, setSelectedButton] = useState('by Phylum')

  return (
    <>
      A description of each of the following taxonomy output files can be found in the “Output Data”
      section of{' '}
      <a
        href="https://github.com/nasa/GeneLab_Data_Processing/tree/master/Amplicon/Illumina/Pipeline_GL-DPPD-7104_Versions/GL-DPPD-7104-C.md#9-taxonomy-plots"
        target="_blank"
        rel="noopener noreferrer"
      >
        Step 9, “Taxonomy Plots”
      </a>
      , of the GeneLab Amplicon Sequencing Pipeline document on GitHub.
      <br></br>
      <br></br>
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
    </>
  )
}
