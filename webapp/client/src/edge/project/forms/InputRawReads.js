import React, { useState, useEffect } from 'react'
import { Card, CardBody, Collapse } from 'reactstrap'
import { isValidFileInput } from '../../common/util'
import { HtmlText } from '../../common/HtmlText'
import { Header } from './SectionHeader'
import { FastqInput } from './FastqInput'
import { SRAAccessionInput } from './SRAAccessionInput'
import { FileInputArray } from './FileInputArray'
import { OptionSelector } from './OptionSelector'
import { components } from './defaults'

export const InputRawReads = (props) => {
  const componentName = 'inputRawReads'
  const [form, setState] = useState({ ...components[componentName] })
  const [validInputs] = useState({ ...components[componentName].validInputs })
  const [collapseParms, setCollapseParms] = useState(false)
  const [doValidation, setDoValidation] = useState(0)
  const [reset, setReset] = useState(0)

  const toggleParms = () => {
    setCollapseParms(!collapseParms)
  }

  const setOption = (inForm, name) => {
    form.inputs[name].value = inForm.option
    form.inputs[name].display = inForm.display ? inForm.display : inForm.option
    setReset(reset + 1)
    setDoValidation(doValidation + 1)
  }

  const setFastqInput = (inForm, name) => {
    form.validForm = inForm.validForm
    form.inputs['seqPlatform'].value = inForm.platform
    form.inputs['seqPlatform'].display = inForm.platform_display
    form.inputs['paired'].value = inForm.paired
    form.inputs[name].value = inForm.fileInput
    form.inputs[name].display = inForm.fileInput_display
    form.fastqInspection = inForm.fastqInspection
    if (validInputs[name]) {
      validInputs[name].isValid = inForm.validForm
    }
    setDoValidation(doValidation + 1)
  }

  const setFileInput = (inForm, name) => {
    form.validForm = inForm.validForm
    form.inputs[name].value = inForm.fileInput
    form.inputs[name].display = inForm.fileInput_display
    if (validInputs[name]) {
      validInputs[name].isValid = inForm.validForm
    }
    setDoValidation(doValidation + 1)
  }

  const setSRAccessionInput = (inForm, name) => {
    form.validForm = inForm.validForm
    form.inputs[name].value = inForm.accessions
    form.inputs[name].display = inForm.accessions_display
    if (validInputs[name]) {
      validInputs[name].isValid = inForm.validForm
    }
    setDoValidation(doValidation + 1)
  }

  useEffect(() => {
    if (props.source) {
      form.inputs['source'].value = props.source
      form.inputs['source'].display = props.sourceDisplay
    }
  }, [props.source]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (props.allExpand > 0) {
      setCollapseParms(false)
    }
  }, [props.allExpand])

  useEffect(() => {
    if (props.allClosed > 0) {
      setCollapseParms(true)
    }
  }, [props.allClosed])

  //trigger validation method when input changes
  useEffect(() => {
    // check input errors
    let errors = ''
    Object.keys(validInputs).forEach((key) => {
      if (!validInputs[key].isValid) {
        errors += validInputs[key].error + '<br/>'
      }
    })

    if (errors === '') {
      //files for server to caculate total input size
      let inputFiles = []
      if (form.inputs['source'].value === 'fastq' && form.inputs['paired'].value) {
        form.inputs['inputFiles'].value.forEach((item) => {
          inputFiles.push(item.R1)
          inputFiles.push(item.R2)
        })
      } else {
        inputFiles = form.inputs['inputFiles'].value
      }
      form.files = inputFiles
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
    <Card className="workflow-card">
      <Header
        toggle={true}
        toggleParms={toggleParms}
        title={props.title}
        collapseParms={collapseParms}
        id={'components[componentName]'}
        isValid={props.isValid}
        errMessage={props.errMessage}
      />
      <Collapse isOpen={!collapseParms} id={'collapseParameters-' + props.name}>
        <CardBody>
          {props.note && (
            <>
              <span className="text-muted edge-text-size-small">
                <HtmlText text={props.note} />
                <br></br>
                <br></br>
              </span>
            </>
          )}
          {props.sourceOptionsOn && (
            <>
              <OptionSelector
                id={'source'}
                name={'source'}
                setParams={setOption}
                options={
                  props.sourceOptions
                    ? props.sourceOptions
                    : components[componentName].inputs['source'].options
                }
                text={components[componentName].inputs['source'].text}
                tooltip={
                  props.tooltip ? props.tooltip : components[componentName].inputs['source'].tooltip
                }
                defaultValue={components[componentName].inputs['source'].value}
                display={components[componentName].inputs['source'].display}
              />
              <br></br>
            </>
          )}
          {form.inputs['source'].value === 'fastq' && (
            <>
              <FastqInput
                name={'inputFiles'}
                setParams={setFastqInput}
                isValidFileInput={
                  props.fastqSettings?.isValidFileInput
                    ? props.fastqSettings?.isValidFileInput
                    : isValidFileInput
                }
                note={props.fastqSettings?.note}
                text={props.fastqSettings?.text ? props.fastqSettings?.text : null}
                tooltip={props.fastqSettings?.tooltip ? props.fastqSettings?.tooltip : null}
                enableInput={
                  props.fastqSettings?.enableInput !== null
                    ? props.fastqSettings?.enableInput
                    : components[componentName].fastqInput.enableInput
                }
                placeholder={
                  props.fastqSettings?.placeholder
                    ? props.fastqSettings?.placeholder
                    : components[componentName].fastqInput.placeholder
                }
                dataSources={
                  props.fastqSettings?.dataSources
                    ? props.fastqSettings?.dataSources
                    : components[componentName].fastqInput.dataSources
                }
                fileTypes={
                  props.fastqSettings?.fileTypes
                    ? props.fastqSettings?.fileTypes
                    : components[componentName].fastqInput.fileTypes
                }
                projectTypes={
                  props.fastqSettings?.projectTypes ? props.fastqSettings?.projectTypes : null
                }
                projectScope={
                  props.fastqSettings?.projectTypes
                    ? props.fastqSettings?.projectTypes
                    : components[componentName].fastqInput.projectTypes
                }
                viewFile={
                  props.fastqSettings?.viewFile !== null
                    ? props.fastqSettings?.viewFile
                    : components[componentName].fastqInput.viewFile
                }
                isOptional={
                  props.fastqSettings?.isOptional !== null
                    ? props.fastqSettings?.isOptional
                    : components[componentName].fastqInput.isOptional
                }
                isPaired={
                  props.fastqSettings?.isPaired !== null
                    ? props.fastqSettings?.isPaired
                    : components[componentName].fastqInput.isPaired
                }
                cleanupInput={
                  props.fastqSettings?.cleanupInput !== null
                    ? props.fastqSettings?.cleanupInput
                    : components[componentName].fastqInput.cleanupInput
                }
                maxInput={
                  props.fastqSettings?.maxInput
                    ? props.fastqSettings?.maxInput
                    : components[componentName].fastqInput.maxInput
                }
                seqPlatformOptions={
                  props.seqPlatformOptions
                    ? props.seqPlatformOptions
                    : components[componentName].inputs['seqPlatform'].options
                }
                seqPlatformText={
                  props.seqPlatformText
                    ? props.seqPlatformText
                    : components[componentName].inputs['seqPlatform'].text
                }
                seqPlatformTooltip={
                  props.seqPlatformTooltip
                    ? props.seqPlatformTooltip
                    : components[componentName].inputs['seqPlatform'].tooltip
                }
                seqPlatformDefaultValue={
                  props.seqPlatformDefaultValue
                    ? props.seqPlatformDefaultValue
                    : components[componentName].inputs['seqPlatform'].value
                }
                seqPlatformDisplay={components[componentName].inputs['seqPlatform'].display}
                pairedText={components[componentName].inputs['paired'].text}
                disableSwitcher={props.disableSwitcher}
              />
              <br></br>
            </>
          )}
          {form.inputs['source'].value === 'fasta' && (
            <>
              <FileInputArray
                setParams={setFileInput}
                name={'inputFiles'}
                isValidFileInput={
                  props.fastaSettings?.isValidFileInput
                    ? props.fastaSettings?.isValidFileInput
                    : isValidFileInput
                }
                note={props.fastaSettings?.note}
                text={
                  props.fastaSettings?.text
                    ? props.fastaSettings?.text
                    : components[componentName].fastaInput.text
                }
                tooltip={
                  props.fastaSettings?.tooltip
                    ? props.fastaSettings?.tooltip
                    : components[componentName].fastaInput.tooltip
                }
                enableInput={
                  props.fastaSettings?.enableInput
                    ? props.fastaSettings?.enableInput
                    : components[componentName].fastaInput.enableInput
                }
                placeholder={
                  props.fastaSettings?.placeholder
                    ? props.fastaSettings?.placeholder
                    : components[componentName].fastaInput.placeholder
                }
                dataSources={
                  props.fastaSettings?.dataSources
                    ? props.fastaSettings?.dataSources
                    : components[componentName].fastaInput.dataSources
                }
                fileTypes={
                  props.fastaSettings?.fileTypes
                    ? props.fastaSettings?.fileTypes
                    : components[componentName].fastaInput.fileTypes
                }
                projectTypes={
                  props.fastaSettings?.projectTypes ? props.fastaSettings?.projectTypes : null
                }
                projectScope={
                  props.fastaSettings?.projectTypes
                    ? props.fastaSettings?.projectTypes
                    : components[componentName].fastaInput.projectTypes
                }
                viewFile={
                  props.fastaSettings?.viewFile
                    ? props.fastaSettings?.viewFile
                    : components[componentName].fastaInput.viewFile
                }
                isOptional={
                  props.fastaSettings?.isOptional
                    ? props.fastaSettings?.isOptional
                    : components[componentName].fastaInput.isOptional
                }
                cleanupInput={
                  props.fastaSettings?.cleanupInput
                    ? props.fastaSettings?.cleanupInput
                    : components[componentName].fastaInput.cleanupInput
                }
                maxInput={
                  props.fastaSettings?.maxInput
                    ? props.fastaSettings?.maxInput
                    : components[componentName].fastaInput.maxInput
                }
              />
            </>
          )}
          {form.inputs['source'].value === 'sra' && (
            <>
              <SRAAccessionInput
                name={'inputFiles'}
                setParams={setSRAccessionInput}
                reset={reset}
              />
              <HtmlText text={components[componentName].sraInput.note} />
              <br></br>
            </>
          )}
        </CardBody>
      </Collapse>
    </Card>
  )
}
