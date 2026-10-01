import React, { useState, useEffect } from 'react'
import { isValidProjectName } from '../../common/util'
import { TextInput } from './TextInput'
import { components } from './defaults'

export const Project = (props) => {
  const componentName = 'project'
  const [form, setState] = useState({ ...components[componentName].init })
  const [validInputs] = useState({ ...components[componentName].validInputs })
  const [doValidation, setDoValidation] = useState(0)

  const setTextInput = (inForm, name) => {
    if (inForm.validForm) {
      setState({
        ...form,
        [name]: inForm.textInput,
      })
      if (validInputs[name]) {
        validInputs[name].isValid = true
      }
    } else {
      setState({
        ...form,
        [name]: null,
      })
      if (validInputs[name]) {
        validInputs[name].isValid = false
      }
    }
    setDoValidation(doValidation + 1)
  }

  useEffect(() => {
    // check input errors
    let errors = ''
    Object.keys(validInputs).forEach((key) => {
      if (!validInputs[key].isValid) {
        errors += validInputs[key].error + '<br/>'
      }
    })

    if (errors === '') {
      form.errMessage = null
      form.validForm = true
    } else {
      form.errMessage = errors
      form.validForm = false
    }
    //force updating parent's inputParams
    props.setParams(form, props.name)
  }, [doValidation]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <TextInput
        name={'projectName'}
        setParams={setTextInput}
        defaultValue={''}
        text={
          props.projectNameText
            ? props.projectNameText
            : components[componentName].params['projectName'].text
        }
        showErrorTooltip={
          props.projectNameShowErrorTooltip
            ? props.projectNameShowErrorTooltip
            : components[componentName].params['projectName'].showErrorTooltip
        }
        isOptional={
          props.projectNameIsOptional
            ? props.projectNameIsOptional
            : components[componentName].params['projectName'].isOptional
        }
        note={props.note ? props.note : components[componentName].params['projectName'].note}
        placeholder={
          props.projectNamePlaceholder
            ? props.projectNamePlaceholder
            : components[componentName].params['projectName'].placeholder
        }
        errMessage={
          props.projectNameErrMessage
            ? props.projectNameErrMessage
            : components[componentName].params['projectName'].errMessage
        }
        isValidTextInput={
          props.projectNameIsValidTextInput ? props.projectNameIsValidTextInput : isValidProjectName
        }
        pattern={props.projectNamePattern ? props.projectNamePattern : null}
        tooltip={
          props.projectNameTooltip
            ? props.projectNameTooltip
            : components[componentName].params['projectName'].tooltip
        }
        tooltipClickable={
          props.projectNameTooltipClickable ? props.projectNameTooltipClickable : false
        }
      />
      <br></br>
      <TextInput
        name={'projectDesc'}
        setParams={setTextInput}
        defaultValue={''}
        text={
          props.projectDescText
            ? props.projectDescText
            : components[componentName].params['projectDesc'].text
        }
        isOptional={
          props.projectDescIsOptional
            ? props.projectDescIsOptional
            : components[componentName].params['projectDesc'].isOptional
        }
        placeholder={
          props.projectDescPlaceholder
            ? props.projectDescPlaceholder
            : components[componentName].params['projectDesc'].placeholder
        }
        isValidTextInput={
          props.projectDescIsValidTextInput
            ? props.projectDescIsValidTextInput
            : () => {
                return true
              }
        }
        tooltip={
          props.projectDescTooltip
            ? props.projectDescTooltip
            : components[componentName].params['projectDesc'].tooltip
        }
        tooltipClickable={
          props.projectDescTooltipClickable ? props.projectDescTooltipClickable : false
        }
      />
    </>
  )
}
