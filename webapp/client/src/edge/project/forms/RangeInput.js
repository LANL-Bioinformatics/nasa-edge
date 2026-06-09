import React, { useState, useEffect } from 'react'
import { Col, Row } from 'reactstrap'
import Slider from 'rc-slider'
import 'rc-slider/assets/index.css'
import { MyTooltip } from '../../common/MyTooltip'
import { defaults } from '../../common/util'
import { components } from './defaults'

export const RangeInput = (props) => {
  const componentName = 'rangeInput'
  const [form, setState] = useState({ ...components[componentName] })
  const [doValidation, setDoValidation] = useState(0)

  const setNewState2 = (name, value) => {
    setState({
      ...form,
      [name]: value,
    })
    setDoValidation(doValidation + 1)
  }

  useEffect(() => {
    form.rangeInput = props.defaultValue
    setState({
      ...form,
      rangeInput: props.defaultValue,
    })
  }, [props.defaultValue]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    //force updating parent's inputParams
    props.setParams(form, props.name)
  }, [doValidation]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Row>
        <Col md="3">
          {props.tooltip ? (
            <MyTooltip
              id={`rangeInputTooltip-${props.name}`}
              tooltip={props.tooltip}
              text={props.text}
              place={props.tooltipPlace ? props.tooltipPlace : defaults.tooltipPlace}
              color={props.tooltipColor ? props.tooltipColor : defaults.tooltipColor}
              showTooltip={props.showTooltip ? props.showTooltip : defaults.showTooltip}
              clickable={props.tooltipClickable ? props.tooltipClickable : false}
            />
          ) : (
            <>{props.text}</>
          )}
        </Col>
        <Col xs="12" md="9">
          {form['rangeInput']}
          <Slider
            name="rangeInput"
            value={form['rangeInput']}
            min={props.min}
            max={props.max}
            step={props.step}
            onChange={(e) => setNewState2('rangeInput', e)}
          />
        </Col>
      </Row>
    </>
  )
}
