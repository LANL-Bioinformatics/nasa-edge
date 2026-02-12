import React, { useState, useEffect } from 'react'
import { Card, CardBody, Collapse } from 'reactstrap'
import { isValidFileInput } from 'src/edge/common/util'
import { Header } from 'src/edge/project/forms/SectionHeader'
import { RadioSelector } from 'src/edge/project/forms/RadioSelector'
import { TextInput } from 'src/edge/project/forms/TextInput'
import { FileInput } from 'src/edge/project/forms/FileInput'
import { OptionSelector } from 'src/edge/project/forms/OptionSelector'
import { RangeInput } from 'src/edge/project/forms/RangeInput'
import { Switcher } from 'src/edge/project/forms/Switcher'
import { IntegerInput } from 'src/edge/project/forms/IntegerInput'
import { isValidOsdGldsAccession, isValidPrimer } from '../../common/util'
import { workflows } from '../defaults'

export const AmpIllumina = (props) => {
  const workflowName = 'AmpIllumina'
  const [collapseParms, setCollapseParms] = useState(false)
  const [form] = useState({ ...workflows[workflowName] })
  const [validInputs, setValidInputs] = useState({ ...workflows[workflowName].validInputs })
  const [doValidation, setDoValidation] = useState(0)

  const toggleParms = () => {
    setCollapseParms(!collapseParms)
  }

  const setOnoff = (onoff) => {
    if (onoff) {
      setCollapseParms(false)
    } else {
      setCollapseParms(true)
    }
    form.paramsOn = onoff
    setDoValidation(doValidation + 1)
  }

  const setRadioOption = (inForm, name) => {
    console.log('setRadioOption', inForm, name)
    form.inputs[name].value = inForm.option
    form.inputs[name].display = inForm.display
    setDoValidation(doValidation + 1)
  }

  const setTextInput = (inForm, name) => {
    //console.log('setTextInput', inForm, name)
    form.inputs[name].value = inForm.textInput
    if (validInputs[name]) {
      validInputs[name].isValid = inForm.validForm
    }
    setDoValidation(doValidation + 1)
  }

  const setFileInput = (inForm, name) => {
    form.inputs[name].value = inForm.fileInput
    form.inputs[name].display = inForm.fileInput_display
    if (validInputs[name]) {
      validInputs[name].isValid = inForm.validForm
    }
    setDoValidation(doValidation + 1)
  }

  const setOption = (inForm, name) => {
    form.inputs[name].value = inForm.option
    form.inputs[name].display = inForm.display
    setDoValidation(doValidation + 1)
  }

  const setRangeInput = (inForm, name) => {
    form.inputs[name].value = inForm.rangeInput
    setDoValidation(doValidation + 1)
  }

  const setIntegerInput = (inForm, name) => {
    form.inputs[name].value = inForm.integerInput
    if (validInputs[name]) {
      validInputs[name].isValid = inForm.validForm
    }
    setDoValidation(doValidation + 1)
  }

  const setSwitcher = (inForm, name) => {
    form.inputs[name].value = inForm.isTrue
    setDoValidation(doValidation + 1)
  }

  useEffect(() => {
    form.paramsOn = props.paramsOn ? props.paramsOn : true
  }, [props.paramsOn]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (
        form.inputs.start_input.value === 'accession' &&
        (key === 'input_file' || key === 'F_primer' || key === 'R_primer')
      ) {
        // skip file input validation if start_input is accession
      } else if (form.inputs.start_input.value === 'input_file' && key === 'accession') {
        // skip accession validation if start_input is input_file
      } else if (!validInputs[key].isValid) {
        errors += validInputs[key].error + '<br/>'
      }
    })

    if (errors === '') {
      //files for server to caculate total input size
      let inputFiles = []
      if (form.inputs['input_file'].value) {
        inputFiles.push(form.inputs['input_file'].value)
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
        title={'Parameters'}
        collapseParms={collapseParms}
        id={workflowName + 'input'}
        isValid={props.isValid}
        errMessage={props.errMessage}
        onoff={props.onoff}
        paramsOn={form.paramsOn}
        setOnoff={setOnoff}
      />
      <Collapse isOpen={!collapseParms && form.paramsOn} id={'collapseParameters-' + props.name}>
        <CardBody style={props.disabled ? { pointerEvents: 'none', opacity: '0.4' } : {}}>
          <RadioSelector
            name={'start_input'}
            setParams={setRadioOption}
            tooltip={workflows[workflowName].inputs['start_input'].tooltip}
            options={workflows[workflowName].inputs['start_input'].options}
            defaultValue={form.inputs['start_input'].value}
            display={form.inputs['start_input'].display}
          />
          <br></br>

          {form.inputs['start_input'].value === 'accession' && (
            <>
              <TextInput
                name={'accession'}
                setParams={setTextInput}
                text={workflows[workflowName].inputs['accession'].text}
                tooltip={workflows[workflowName].inputs['accession'].tooltip}
                tooltipClickable={true}
                defaultValue={workflows[workflowName].inputs['accession']['textInput'].defaultValue}
                placeholder={workflows[workflowName].inputs['accession']['textInput'].placeholder}
                isOptional={workflows[workflowName].inputs['accession']['textInput'].isOptional}
                toUpperCase={true}
                isValidTextInput={isValidOsdGldsAccession}
                errMessage={'Invalid OSD or GLDS accession'}
                showErrorTooltip={true}
              />
              <br></br>
            </>
          )}
          {form.inputs['start_input'].value === 'input_file' && (
            <>
              <FileInput
                name={'input_file'}
                setParams={setFileInput}
                isValidFileInput={isValidFileInput}
                text={workflows[workflowName].inputs['input_file'].text}
                tooltip={workflows[workflowName].inputs['input_file'].tooltip}
                enableInput={workflows[workflowName].inputs['input_file']['fileInput'].enableInput}
                placeholder={workflows[workflowName].inputs['input_file']['fileInput'].placeholder}
                dataSources={workflows[workflowName].inputs['input_file']['fileInput'].dataSources}
                fileTypes={workflows[workflowName].inputs['input_file']['fileInput'].fileTypes}
                viewFile={workflows[workflowName].inputs['input_file']['fileInput'].viewFile}
                isOptional={workflows[workflowName].inputs['input_file']['fileInput'].isOptional}
                cleanupInput={
                  workflows[workflowName].inputs['input_file']['fileInput'].cleanupInput
                }
                errMessage={'Runsheet CSV file is required'}
                showErrorTooltip={true}
              />
              <br></br>
              <TextInput
                name={'group'}
                setParams={setTextInput}
                text={workflows[workflowName].inputs['group'].text}
                tooltip={workflows[workflowName].inputs['group'].tooltip}
                tooltipClickable={true}
                defaultValue={workflows[workflowName].inputs['group']['textInput'].defaultValue}
                placeholder={workflows[workflowName].inputs['group']['textInput'].placeholder}
                isOptional={workflows[workflowName].inputs['group']['textInput'].isOptional}
                errMessage={'Required'}
                showErrorTooltip={true}
              />
              <br></br>
              <TextInput
                name={'samples_column'}
                setParams={setTextInput}
                text={workflows[workflowName].inputs['samples_column'].text}
                tooltip={workflows[workflowName].inputs['samples_column'].tooltip}
                tooltipClickable={true}
                defaultValue={
                  workflows[workflowName].inputs['samples_column']['textInput'].defaultValue
                }
                placeholder={
                  workflows[workflowName].inputs['samples_column']['textInput'].placeholder
                }
                isOptional={
                  workflows[workflowName].inputs['samples_column']['textInput'].isOptional
                }
                errMessage={'Required'}
                showErrorTooltip={true}
              />
              <br></br>
              <TextInput
                name={'F_primer'}
                setParams={setTextInput}
                text={workflows[workflowName].inputs['F_primer'].text}
                tooltip={workflows[workflowName].inputs['F_primer'].tooltip}
                tooltipClickable={true}
                defaultValue={workflows[workflowName].inputs['F_primer']['textInput'].defaultValue}
                placeholder={workflows[workflowName].inputs['F_primer']['textInput'].placeholder}
                isOptional={workflows[workflowName].inputs['F_primer']['textInput'].isOptional}
                isValidTextInput={isValidPrimer}
                errMessage={'Invalid primer sequence'}
                showErrorTooltip={true}
                toUpperCase={true}
              />
              <br></br>
              <TextInput
                name={'R_primer'}
                setParams={setTextInput}
                text={workflows[workflowName].inputs['R_primer'].text}
                tooltip={workflows[workflowName].inputs['R_primer'].tooltip}
                tooltipClickable={true}
                defaultValue={workflows[workflowName].inputs['R_primer']['textInput'].defaultValue}
                placeholder={workflows[workflowName].inputs['R_primer']['textInput'].placeholder}
                isOptional={workflows[workflowName].inputs['R_primer']['textInput'].isOptional}
                isValidTextInput={isValidPrimer}
                errMessage={'Invalid primer sequence'}
                showErrorTooltip={true}
                toUpperCase={true}
              />
              <br></br>
            </>
          )}
          <OptionSelector
            name={'target_region'}
            setParams={setOption}
            text={workflows[workflowName].inputs['target_region'].text}
            tooltip={workflows[workflowName].inputs['target_region'].tooltip}
            options={workflows[workflowName].inputs['target_region'].options}
            defaultValue={form.inputs['target_region'].value}
          />
          <br></br>
          <OptionSelector
            name={'trim_primers'}
            setParams={setOption}
            text={workflows[workflowName].inputs['trim_primers'].text}
            tooltip={workflows[workflowName].inputs['trim_primers'].tooltip}
            options={workflows[workflowName].inputs['trim_primers'].options}
            defaultValue={form.inputs['trim_primers'].value}
          />
          <br></br>
          <OptionSelector
            name={'primers_linked'}
            setParams={setOption}
            text={workflows[workflowName].inputs['primers_linked'].text}
            tooltip={workflows[workflowName].inputs['primers_linked'].tooltip}
            options={workflows[workflowName].inputs['primers_linked'].options}
            defaultValue={form.inputs['primers_linked'].value}
          />
          <br></br>
          <OptionSelector
            name={'anchored_primers'}
            setParams={setOption}
            text={workflows[workflowName].inputs['anchored_primers'].text}
            tooltip={workflows[workflowName].inputs['anchored_primers'].tooltip}
            options={workflows[workflowName].inputs['anchored_primers'].options}
            defaultValue={form.inputs['anchored_primers'].value}
          />
          <br></br>
          <RangeInput
            name={'min_cutadapt_len'}
            setParams={setRangeInput}
            text={workflows[workflowName].inputs['min_cutadapt_len'].text}
            tooltip={workflows[workflowName].inputs['min_cutadapt_len'].tooltip}
            defaultValue={
              workflows[workflowName].inputs['min_cutadapt_len']['rangeInput'].defaultValue
            }
            min={workflows[workflowName].inputs['min_cutadapt_len']['rangeInput'].min}
            max={workflows[workflowName].inputs['min_cutadapt_len']['rangeInput'].max}
            step={workflows[workflowName].inputs['min_cutadapt_len']['rangeInput'].step}
          />
          <br></br>
          <OptionSelector
            name={'discard_untrimmed'}
            setParams={setOption}
            text={workflows[workflowName].inputs['discard_untrimmed'].text}
            tooltip={workflows[workflowName].inputs['discard_untrimmed'].tooltip}
            options={workflows[workflowName].inputs['discard_untrimmed'].options}
            defaultValue={form.inputs['discard_untrimmed'].value}
          />
          <br></br>
          <RangeInput
            name={'left_trunc'}
            setParams={setRangeInput}
            text={workflows[workflowName].inputs['left_trunc'].text}
            tooltip={workflows[workflowName].inputs['left_trunc'].tooltip}
            defaultValue={workflows[workflowName].inputs['left_trunc']['rangeInput'].defaultValue}
            min={workflows[workflowName].inputs['left_trunc']['rangeInput'].min}
            max={workflows[workflowName].inputs['left_trunc']['rangeInput'].max}
            step={workflows[workflowName].inputs['left_trunc']['rangeInput'].step}
          />
          <br></br>
          <RangeInput
            name={'right_trunc'}
            setParams={setRangeInput}
            text={workflows[workflowName].inputs['right_trunc'].text}
            tooltip={workflows[workflowName].inputs['right_trunc'].tooltip}
            defaultValue={workflows[workflowName].inputs['right_trunc']['rangeInput'].defaultValue}
            min={workflows[workflowName].inputs['right_trunc']['rangeInput'].min}
            max={workflows[workflowName].inputs['right_trunc']['rangeInput'].max}
            step={workflows[workflowName].inputs['right_trunc']['rangeInput'].step}
          />
          <br></br>
          <RangeInput
            name={'left_maxEE'}
            setParams={setRangeInput}
            text={workflows[workflowName].inputs['left_maxEE'].text}
            tooltip={workflows[workflowName].inputs['left_maxEE'].tooltip}
            defaultValue={workflows[workflowName].inputs['left_maxEE']['rangeInput'].defaultValue}
            min={workflows[workflowName].inputs['left_maxEE']['rangeInput'].min}
            max={workflows[workflowName].inputs['left_maxEE']['rangeInput'].max}
            step={workflows[workflowName].inputs['left_maxEE']['rangeInput'].step}
          />
          <br></br>
          <RangeInput
            name={'right_maxEE'}
            setParams={setRangeInput}
            text={workflows[workflowName].inputs['right_maxEE'].text}
            tooltip={workflows[workflowName].inputs['right_maxEE'].tooltip}
            defaultValue={workflows[workflowName].inputs['right_maxEE']['rangeInput'].defaultValue}
            min={workflows[workflowName].inputs['right_maxEE']['rangeInput'].min}
            max={workflows[workflowName].inputs['right_maxEE']['rangeInput'].max}
            step={workflows[workflowName].inputs['right_maxEE']['rangeInput'].step}
          />
          <br></br>
          <OptionSelector
            name={'concatenate_reads_only'}
            setParams={setOption}
            text={workflows[workflowName].inputs['concatenate_reads_only'].text}
            tooltip={workflows[workflowName].inputs['concatenate_reads_only'].tooltip}
            options={workflows[workflowName].inputs['concatenate_reads_only'].options}
            defaultValue={form.inputs['concatenate_reads_only'].value}
          />
          <br></br>
          <IntegerInput
            name={'rarefaction_depth'}
            setParams={setIntegerInput}
            text={workflows[workflowName].inputs['rarefaction_depth'].text}
            tooltip={workflows[workflowName].inputs['rarefaction_depth'].tooltip}
            defaultValue={
              workflows[workflowName].inputs['rarefaction_depth']['integerInput'].defaultValue
            }
            min={workflows[workflowName].inputs['rarefaction_depth']['integerInput'].min}
            max={workflows[workflowName].inputs['rarefaction_depth']['integerInput'].max}
            errMessage={validInputs['rarefaction_depth'].error}
            showErrorTooltip={true}
          />
          <br></br>
          <OptionSelector
            name={'diff_abund_method'}
            setParams={setOption}
            text={workflows[workflowName].inputs['diff_abund_method'].text}
            tooltip={workflows[workflowName].inputs['diff_abund_method'].tooltip}
            options={workflows[workflowName].inputs['diff_abund_method'].options}
            defaultValue={form.inputs['diff_abund_method'].value}
          />
          <br></br>
          <Switcher
            id={'remove_struc_zeros'}
            name={'remove_struc_zeros'}
            setParams={setSwitcher}
            text={workflows[workflowName].inputs['remove_struc_zeros'].text}
            tooltip={workflows[workflowName].inputs['remove_struc_zeros'].tooltip}
            defaultValue={
              workflows[workflowName].inputs['remove_struc_zeros']['switcher'].defaultValue
            }
            trueText={workflows[workflowName].inputs['remove_struc_zeros']['switcher'].trueText}
            falseText={workflows[workflowName].inputs['remove_struc_zeros']['switcher'].falseText}
          />
          <br></br>
          <Switcher
            id={'remove_rare'}
            name={'remove_rare'}
            setParams={setSwitcher}
            text={workflows[workflowName].inputs['remove_rare'].text}
            tooltip={workflows[workflowName].inputs['remove_rare'].tooltip}
            defaultValue={workflows[workflowName].inputs['remove_rare']['switcher'].defaultValue}
            trueText={workflows[workflowName].inputs['remove_rare']['switcher'].trueText}
            falseText={workflows[workflowName].inputs['remove_rare']['switcher'].falseText}
          />
          <br></br>
          <RangeInput
            name={'prevalence_cutoff'}
            setParams={setRangeInput}
            text={workflows[workflowName].inputs['prevalence_cutoff'].text}
            tooltip={workflows[workflowName].inputs['prevalence_cutoff'].tooltip}
            defaultValue={
              workflows[workflowName].inputs['prevalence_cutoff']['rangeInput'].defaultValue
            }
            min={workflows[workflowName].inputs['prevalence_cutoff']['rangeInput'].min}
            max={workflows[workflowName].inputs['prevalence_cutoff']['rangeInput'].max}
            step={workflows[workflowName].inputs['prevalence_cutoff']['rangeInput'].step}
          />
          <br></br>
          <RangeInput
            name={'library_cutoff'}
            setParams={setRangeInput}
            text={workflows[workflowName].inputs['library_cutoff'].text}
            tooltip={workflows[workflowName].inputs['library_cutoff'].tooltip}
            defaultValue={
              workflows[workflowName].inputs['library_cutoff']['rangeInput'].defaultValue
            }
            min={workflows[workflowName].inputs['library_cutoff']['rangeInput'].min}
            max={workflows[workflowName].inputs['library_cutoff']['rangeInput'].max}
            step={workflows[workflowName].inputs['library_cutoff']['rangeInput'].step}
          />
          <br></br>
        </CardBody>
      </Collapse>
    </Card>
  )
}
