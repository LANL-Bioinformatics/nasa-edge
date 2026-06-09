import React, { useState } from 'react'
import { Button, ButtonGroup, CardHeader, Badge } from 'reactstrap'
import CIcon from '@coreui/icons-react'
import { cilChevronTop, cilChevronBottom } from '@coreui/icons'
import { colors } from 'src/util'
import { AISummaryButton } from './AISummaryButton'

export const Header = (props) => {
  const [headerColor, setHeaderColor] = useState(colors.light)

  return (
    <CardHeader
      style={{ backgroundColor: headerColor, cursor: 'pointer' }}
      onMouseEnter={(e) => setHeaderColor(colors.gray)}
      onMouseLeave={() => setHeaderColor(colors.light)}
      onClick={props.toggleParms}
    >
      {props.toggle ? (
        <>
          <span
            className="edge-card-header-action"
            data-target="#collapseParameters"
            onClick={props.toggleParms}
          >
            {!props.collapseParms ? (
              <CIcon icon={cilChevronTop} />
            ) : (
              <CIcon icon={cilChevronBottom} />
            )}
          </span>
          &nbsp;&nbsp;&nbsp;
        </>
      ) : (
        <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</>
      )}
      <span className="edge-card-header">
        {props.title}{' '}
        {props.badge ? (
          <Badge style={{ fontSize: 9 }} color="danger">
            {props.badge}
          </Badge>
        ) : (
          ''
        )}
      </span>
      {(props.aiSummary || props.onoff) && (
        <div className="edge-card-header-actions" onClick={(event) => event.stopPropagation()}>
          {props.aiSummary && (
            <AISummaryButton
              sectionKey={props.aiSummary.sectionKey}
              title={props.aiSummary.title || props.title}
              project={props.aiSummary.project}
              userType={props.aiSummary.userType}
            />
          )}
          {props.onoff && (
            <ButtonGroup className="mr-3" aria-label="First group" size="sm">
              <Button
                color="outline-primary"
                onClick={() => props.setOnoff(true)}
                active={props.paramsOn}
              >
                On
              </Button>
              <Button
                color="outline-primary"
                onClick={() => {
                  props.setOnoff(false)
                  props.setCollapseParms(true)
                }}
                active={!props.paramsOn}
              >
                Off
              </Button>
            </ButtonGroup>
          )}
        </div>
      )}
    </CardHeader>
  )
}
