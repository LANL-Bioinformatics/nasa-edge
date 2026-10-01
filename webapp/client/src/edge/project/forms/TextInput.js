import React, { useState, useEffect } from 'react'
import { Col, Row, Input } from 'reactstrap'
import { useForm } from 'react-hook-form'
import { MyTooltip, ErrorTooltip } from '../../common/MyTooltip'
import { defaults } from '../../common/util'
import { components } from './defaults'

export const TextInput = (props) => {
  const componentName = 'textInput'
  const [form, setState] = useState({ ...components[componentName] })
  const [doValidation, setDoValidation] = useState(0)

  const {
    register,
    reset,
    formState: { errors },
    trigger,
  } = useForm({
    mode: defaults['form_mode'],
  })

  const textInputReg = {
    ...register('textInput', {
      required: !props.isOptional ? props.errMessage : false,
      validate: {
        // Validation pattern
        validInput: (value) =>
          (props.isValidTextInput
            ? props.isValidTextInput(value, props.isOptional, props.pattern)
            : true) || props.errMessage,
      },
    }),
  }

  const setNewState = (e) => {
    setState({
      ...form,
      [e.target.name]: e.target.value,
    })
    setDoValidation(doValidation + 1)
  }

  const setNewState2 = (name, value) => {
    setState({
      ...form,
      [name]: value,
      validForm: value ? true : false,
    })
    setDoValidation(doValidation + 1)
  }

  useEffect(() => {
    setState({ ...components[componentName] })
    if (props.defaultValue) {
      setNewState2('textInput', props.defaultValue)
    } else {
      setNewState2('textInput', '')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (props.defaultValue) {
      reset({ textInput: props.defaultValue })
    } else {
      reset({ textInput: '' })
    }
    setDoValidation(doValidation + 1)
  }, [props.reset]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    //validate form
    trigger().then((result) => {
      form.validForm = result
      if (result) {
        form.errMessage = ''
        // empty input
        if (!props.isOptional && form.textInput.trim() === '') {
          form.validForm = false
          form.errMessage = props.errMessage
        }
      } else {
        let errMessage = ''
        if (errors.textInput) {
          errMessage += errors.textInput.message
        }
        form.errMessage = errMessage
      }
      //force updating parent's inputParams
      props.setParams(form, props.name)
    })
  }, [doValidation]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Row>
        <Col md={props.text ? 3 : 0}>
          {props.tooltip ? (
            <MyTooltip
              id={`textInputTooltip-${props.name}`}
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
          {errors && errors.textInput && props.showErrorTooltip && (
            <ErrorTooltip
              id={`textInputErrTooltip-${props.name}`}
              tooltip={errors.textInput.message}
            />
          )}
        </Col>
        <Col xs="12" md={props.text ? 9 : 12}>
          <Input
            type="text"
            name="textInput"
            id={props.name}
            defaultValue={props.defaultValue}
            placeholder={props.placeholder}
            style={errors.textInput ? defaults.inputStyleWarning : defaults.inputStyle}
            onInput={(e) => {
              if (props.toUpperCase) e.target.value = ('' + e.target.value).toUpperCase()
            }}
            onChange={(e) => {
              textInputReg.onChange(e) // method from hook form register
              setNewState(e) // your method
            }}
            innerRef={textInputReg.ref}
          />
          {errors && errors.textInput && props.showError && (
            <p className="edge-form-input-error">{errors.textInput.message}</p>
          )}
        </Col>
      </Row>
    </>
  )
}
