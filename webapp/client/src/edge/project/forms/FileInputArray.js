import React, { useState, useEffect } from 'react'
import { Button, Col, Row } from 'reactstrap'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import FileSelector from './FileSelector'
import { MyTooltip, WarningTooltip } from '../../common/MyTooltip'
import { defaults } from '../../common/util'
import { components } from './defaults'

export const FileInputArray = (props) => {
  const componentName = 'fileInputArray'
  const [form, setState] = useState({ ...components[componentName] })
  const [doValidation, setDoValidation] = useState(0)
  const { control } = useForm({
    mode: defaults['form_mode'],
  })

  const {
    fields: fileInputFields,
    append: fileInputAppend,
    remove: fileInputRemove,
  } = useFieldArray({
    control,
    name: 'singleFileInput',
  })

  const handleFileSelection = (path, type, index, key, source) => {
    if (props.isValidFileInput(key, path)) {
      form.fileInput[index] = path
      form.fileInput_display[index] = key
      form.fileInput_isValid[index] = true
      form.fileInput_source[index] = source
    } else {
      form.fileInput[index] = null
      form.fileInput_display[index] = null
      form.fileInput_isValid[index] = false
      form.fileInput_source[index] = null
    }

    setDoValidation(doValidation + 1)
  }

  const validateInputs = () => {
    let valid = true
    if (!props.isOptional && form.fileInput.length === 0) {
      valid = false
    } else {
      form.fileInput_isValid.forEach((isValid) => {
        if (!isValid) {
          valid = false
        }
      })
    }
    return valid
  }

  //default 1 dataset
  useEffect(() => {
    if (!props.isOptional) {
      fileInputAppend({ name: 'singleFileInput' })
    }
    setState({
      ...form,
      fileInput: [],
      fileInput_display: [],
      fileInput_isValid: [],
      fileInput_source: [],
    })
    setDoValidation(doValidation + 1)
  }, [props.reset]) // eslint-disable-line react-hooks/exhaustive-deps

  //trigger validation method when input changes
  useEffect(() => {
    //console.log('fileinputarray', form)
    //validate data inputs
    form.validForm = validateInputs()
    //force updating parent's inputParams
    props.setParams(form, props.name)
  }, [doValidation]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Row>
        {(!props.maxInput || props.maxInput > 1) && (
          <Col md="3">
            {props.tooltip ? (
              <MyTooltip
                id={`fileInputArrayTooltip-${props.name}`}
                tooltip={props.tooltip}
                text={props.text}
                place={props.tooltipPlace ? props.tooltipPlace : defaults.tooltipPlace}
                color={props.tooltipColor ? props.tooltipColor : defaults.tooltipColor}
                showTooltip={props.showTooltip ? props.showTooltip : defaults.showTooltip}
              />
            ) : (
              <>{props.mainText ? props.mainText : props.text}</>
            )}
            {!props.isOptional && fileInputFields.length === 0 && (
              <WarningTooltip id={props.name} tooltip={'Required at least one input.'} />
            )}
          </Col>
        )}
        {(!props.maxInput || props.maxInput > 1) && (
          <Col xs="12" md="9">
            <Button
              size="sm"
              className="btn-pill edge-button-sm"
              color="outline-primary"
              onClick={() => {
                if (props.maxInput && fileInputFields.length >= props.maxInput) {
                  alert(`Only allows ${props.maxInput} ${props.text} input data set(s).`)
                } else {
                  fileInputAppend({ name: 'singleFileInput' })
                  setDoValidation(doValidation + 1)
                }
              }}
            >
              Add more {props.text} &nbsp; <i className="cui-file"></i>
            </Button>
            <br></br>
            <br></br>
          </Col>
        )}
      </Row>
      {fileInputFields.map((item, index) => (
        <div key={item.id}>
          <Row>
            {!props.maxInput || props.maxInput > 1 ? (
              <Col md="3" className="edge-sub-field">
                {' '}
                {props.text} #{index + 1}
              </Col>
            ) : (
              <Col md="3">
                {props.tooltip ? (
                  <MyTooltip
                    id={`fileInputArrayTooltip-${props.name}`}
                    tooltip={props.tooltip}
                    text={props.text}
                    place={props.tooltipPlace ? props.tooltipPlace : defaults.tooltipPlace}
                    color={props.tooltipColor ? props.tooltipColor : defaults.tooltipColor}
                    showTooltip={props.showTooltip ? props.showTooltip : defaults.showTooltip}
                  />
                ) : (
                  <>{props.text}</>
                )}
              </Col>
            )}
            <Col xs="12" md="9">
              <Controller
                render={({ field: { ref, ...rest }, fieldState }) => (
                  <FileSelector
                    {...rest}
                    {...fieldState}
                    enableInput={props.enableInput}
                    cleanupInput={props.cleanupInput}
                    placeholder={props.placeholder}
                    isValidFileInput={form.fileInput_isValid[index]}
                    dataSources={props.dataSources}
                    fileTypes={props.fileTypes}
                    projectTypes={props.projectTypes}
                    projectScope={props.projectScope}
                    viewFile={props.viewFile}
                    fieldname={'fileInput'}
                    index={index}
                    onChange={handleFileSelection}
                  />
                )}
                name={`fileInput.${index}.R`}
                control={control}
              />
            </Col>
          </Row>
          {(!props.maxInput || props.maxInput > 1) && (
            <Row>
              <Col md="3"></Col>
              <Col xs="12" md="9">
                <Button
                  size="sm"
                  className="btn-pill edge-button-sm"
                  color="ghost-primary"
                  onClick={() => {
                    form.fileInput.splice(index, 1)
                    form.fileInput_display.splice(index, 1)
                    form.fileInput_isValid.splice(index, 1)
                    form.fileInput_source.splice(index, 1)
                    fileInputRemove(index)
                    setDoValidation(doValidation + 1)
                  }}
                >
                  {' '}
                  Remove{' '}
                </Button>
              </Col>
            </Row>
          )}
          <br></br>
        </div>
      ))}
    </>
  )
}
