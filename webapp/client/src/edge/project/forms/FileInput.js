import React, { useState, useEffect } from 'react'
import { Col, Row } from 'reactstrap'
import { MyTooltip, ErrorTooltip } from '../../common/MyTooltip'
import { defaults } from '../../common/util'
import FileSelector from './FileSelector'
import { components } from './defaults'

export const FileInput = (props) => {
  const componentName = 'fileInput'
  const [form, setState] = useState({ ...components[componentName] })
  const [doValidation, setDoValidation] = useState(0)

  const handleFileSelection = (filename, type, index, key, source) => {
    form.fileInput = filename
    form.fileInput_display = key
    form.fileInput_source = source
    if ((props.isOptional && !key) || props.isValidFileInput(key, filename)) {
      form.validForm = true
    } else {
      form.validForm = false
    }
    setDoValidation(doValidation + 1)
  }

  useEffect(() => {
    setState({ ...components[componentName] })
  }, [props.reset])

  //trigger validation method when input changes
  useEffect(() => {
    //force updating parent's inputParams
    if (props.isOptional && !form.fileInput) {
      form.validForm = true
    }
    props.setParams(form, props.name)
  }, [doValidation]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Row>
        <Col md="3">
          {props.tooltip ? (
            <MyTooltip
              id={`fileInputTooltip-${props.name}`}
              tooltip={props.tooltip}
              text={props.text}
              place={props.tooltipPlace ? props.tooltipPlace : defaults.tooltipPlace}
              color={props.tooltipColor ? props.tooltipColor : defaults.tooltipColor}
              showTooltip={props.showTooltip ? props.showTooltip : defaults.showTooltip}
            />
          ) : (
            <>{props.text}</>
          )}
          {!form.validForm && props.errMessage && props.showErrorTooltip && (
            <ErrorTooltip
              id={`fileInputErrTooltip-${props.name}`}
              tooltip={form.fileInput ? 'Invalid url' : props.errMessage}
            />
          )}
        </Col>
        <Col xs="12" md="9">
          <FileSelector
            onChange={handleFileSelection}
            enableInput={props.enableInput}
            placeholder={props.placeholder}
            isValidFileInput={form.validForm}
            dataSources={props.dataSources}
            projectScope={props.projectScope}
            projectTypes={props.projectTypes}
            fileTypes={props.fileTypes}
            fieldname={props.name}
            viewFile={props.viewFile ? props.viewFile : false}
            isOptional={props.isOptional ? props.isOptional : false}
            cleanupInput={props.cleanupInput ? props.cleanupInput : false}
          />
        </Col>
      </Row>
    </>
  )
}
