import React, { useState, useEffect } from 'react'
import { Button, ButtonGroup, Col, Row } from 'reactstrap'
import { MyTooltip } from '../../common/MyTooltip'
import { defaults } from '../../common/util'
import { components } from './defaults'

export const Switcher = (props) => {
  const componentName = 'switcher'
  const [form, setState] = useState({ ...components[componentName], isTrue: props.defaultValue })
  const [doValidation, setDoValidation] = useState(0)

  const setNewState2 = (name, value) => {
    setState({
      ...form,
      [name]: value,
    })
    setDoValidation(doValidation + 1)
  }

  useEffect(() => {
    setState({ ...components[componentName], isTrue: props.defaultValue })
  }, [props.defaultValue, props.reset]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (props.disableFalse) {
      setNewState2('isTrue', true)
    } else if (props.disableTrue) {
      setNewState2('isTrue', false)
    }
  }, [props.disableFalse, props.disableTrue]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    //force updating parent's inputParams
    props.setParams(form, props.name)
  }, [doValidation]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Row>
        <Col md={props.colMd1 ? props.colMd1 : '3'}>
          {props.tooltip ? (
            <MyTooltip
              id={`switcherTooltip-${props.name}`}
              tooltip={props.tooltip}
              text={props.text}
              place={props.tooltipPlace ? props.tooltipPlace : defaults.tooltipPlace}
              color={props.tooltipColor ? props.tooltipColor : defaults.tooltipColor}
              showTooltip={props.showTooltip ? props.showTooltip : defaults.showTooltip}
              clickable={props.tooltipClickable ? props.tooltipClickable : false}
            />
          ) : (
            <>{props.text}</>
          )}{' '}
        </Col>
        <Col xs="12" md={props.colMd2 ? props.colMd2 : '9'}>
          <ButtonGroup className="mr-3" aria-label="First group" size="sm">
            <Button
              disabled={props.disableTrue ? true : false}
              color="outline-primary"
              onClick={() => {
                setNewState2('isTrue', true)
              }}
              active={form.isTrue}
            >
              {props.trueText}
            </Button>
            <Button
              disabled={props.disableFalse ? true : false}
              color="outline-primary"
              onClick={() => {
                setNewState2('isTrue', false)
              }}
              active={!form.isTrue}
            >
              {props.falseText}
            </Button>
          </ButtonGroup>
        </Col>
      </Row>
    </>
  )
}
