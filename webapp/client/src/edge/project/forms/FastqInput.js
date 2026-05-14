import React, { useState, useEffect, useRef } from 'react'
import { MyTooltip } from '../../common/MyTooltip'
import { MessageDialog } from '../../common/Dialogs'
import { defaults, capitalizeFirstLetter } from '../../common/util'
import { inspectFastqFiles, FASTQ_PLATFORM, FASTQ_LAYOUT } from '../../common/fastqInspector'
import { Switcher } from './Switcher'
import { FileInputArray } from './FileInputArray'
import { PairedFileInputArray } from './PairedFileInputArray'
import { components } from './defaults'
import { OptionSelector } from './OptionSelector'

export const FastqInput = (props) => {
  const componentName = 'fastqInput'
  const [form, setState] = useState({
    ...components[componentName].init,
    platform: props.seqPlatformDefaultValue,
  })
  const [doValidation, setDoValidation] = useState(0)
  const [inspectionNotice, setInspectionNotice] = useState({
    isOpen: false,
    message: '',
  })
  const inspectionRun = useRef(0)

  const setNewState2 = (name, value) => {
    inspectionRun.current += 1
    setState({
      ...form,
      [name]: value,
    })
    setDoValidation(doValidation + 1)
  }
  const setSwitcher = (inForm, name) => {
    setNewState2(name, inForm.isTrue)
  }
  const setPlatform = (inForm, name) => {
    inspectionRun.current += 1
    if (inForm.option.toLowerCase() !== 'illumina') {
      form.paired = false
    } else if (props.isPaired != null) {
      form.paired = props.isPaired
    }
    form['platform'] = inForm.option
    form['platform_display'] = inForm.display ? inForm.display : inForm.option
    setDoValidation((value) => value + 1)
  }
  const getPlatformOption = (platform) => {
    const match = props.seqPlatformOptions?.find(
      (item) =>
        item.value.toLowerCase() === platform.toLowerCase() ||
        item.text.toLowerCase() === platform.toLowerCase(),
    )

    return {
      value: match ? match.value : platform,
      display: match ? match.text : platform,
    }
  }
  const hasPairingProblem = (result) =>
    result.mismatch || (result.reason || '').includes('missing an R')
  const getDetectedPaired = (result) => {
    if (hasPairingProblem(result)) {
      return false
    }
    if (result.layout === FASTQ_LAYOUT.TWO_FILE || result.layout === FASTQ_LAYOUT.INTERLEAVED) {
      return true
    }
    if (result.layout === FASTQ_LAYOUT.SINGLE) {
      return false
    }
    return null
  }
  const getLayoutDisplay = (result) => {
    if (result.mismatch) {
      return 'Not paired (R1/R2 names mismatch)'
    }
    if ((result.reason || '').includes('missing an R')) {
      return 'Not paired (missing mate record)'
    }
    if (result.layout === FASTQ_LAYOUT.TWO_FILE) {
      return 'Paired-end (R1/R2 files)'
    }
    if (result.layout === FASTQ_LAYOUT.INTERLEAVED) {
      return 'Paired-end (interleaved FASTQ)'
    }
    if (result.layout === FASTQ_LAYOUT.SINGLE) {
      return result.longReadDetected ? 'Single-end or long-read' : 'Single-end'
    }
    return 'Unknown'
  }
  const getPlatformDisplay = (fastqForm) =>
    fastqForm.platform_display || fastqForm.platform || FASTQ_PLATFORM.UNKNOWN
  const getNoticeAction = (interleavedChanged, pairingProblem) => {
    if (interleavedChanged) {
      return 'Interleaved paired FASTQ was detected; the selected file remains in the single-file input.'
    }
    if (pairingProblem) {
      return 'The form was not changed; please review the selected R1/R2 FASTQ files.'
    }
    return 'The form was updated to match the detected FASTQ sample.'
  }
  const getInspectionNotice = (result, selectedForm) => {
    const detectedPaired = getDetectedPaired(result)
    const detectedPlatform = getPlatformOption(result.platform)
    const selectedPlatform = getPlatformDisplay(selectedForm)
    const interleavedChanged = result.layout === FASTQ_LAYOUT.INTERLEAVED && !selectedForm.paired
    const pairingProblem = hasPairingProblem(result)
    const platformChanged =
      result.platform !== FASTQ_PLATFORM.UNKNOWN &&
      detectedPlatform.value.toLowerCase() !== (selectedForm.platform || '').toLowerCase()
    const pairedChanged =
      result.layout !== FASTQ_LAYOUT.INTERLEAVED &&
      detectedPaired !== null &&
      detectedPaired !== selectedForm.paired

    if (!platformChanged && !pairedChanged && !interleavedChanged) {
      return null
    }

    const platformText =
      result.platform === FASTQ_PLATFORM.UNKNOWN
        ? `${FASTQ_PLATFORM.UNKNOWN} (kept ${selectedPlatform})`
        : detectedPlatform.display

    return [
      'Detected FASTQ settings differ from your current selection.',
      '<br/><br/>',
      `Detected platform: ${platformText}`,
      '<br/>',
      `Detected read format: ${getLayoutDisplay(result)}`,
      '<br/><br/>',
      getNoticeAction(interleavedChanged, pairingProblem),
    ].join('')
  }
  const getInspectionSources = (fastqForm) => {
    if (!fastqForm.validForm) {
      return []
    }

    if (fastqForm.paired) {
      const pair = (fastqForm.fileInput_source || []).find((item) => item?.R1 && item?.R2)
      return pair ? [pair.R1, pair.R2] : []
    }

    const source = (fastqForm.fileInput_source || []).find(Boolean)
    return source ? [source] : []
  }
  const inspectSelectedFastq = (fastqForm) => {
    const sources = getInspectionSources(fastqForm)
    if (sources.length === 0) {
      return
    }

    const runId = inspectionRun.current + 1
    inspectionRun.current = runId

    inspectFastqFiles(sources, props.fastqInspectionOptions)
      .then((result) => {
        if (inspectionRun.current !== runId) {
          return
        }
        const notice = getInspectionNotice(result, fastqForm)

        setState((current) => {
          const next = {
            ...current,
            fastqInspection: result,
          }

          if (result.layout === FASTQ_LAYOUT.TWO_FILE) {
            next.paired = true
          } else if (result.layout === FASTQ_LAYOUT.SINGLE) {
            next.paired = false
          }

          if (result.platform !== FASTQ_PLATFORM.UNKNOWN) {
            const platform = getPlatformOption(result.platform)
            next.platform = platform.value
            next.platform_display = platform.display
            if (result.platform !== FASTQ_PLATFORM.ILLUMINA) {
              next.paired = false
            }
          }

          return next
        })
        if (notice) {
          setInspectionNotice({
            isOpen: true,
            message: notice,
          })
        }
        setDoValidation((value) => value + 1)
      })
      .catch((error) => {
        if (inspectionRun.current !== runId) {
          return
        }
        setState((current) => ({
          ...current,
          fastqInspection: {
            ok: false,
            reason: error.message,
          },
        }))
        setDoValidation((value) => value + 1)
      })
  }
  const setFileInput = (inForm, name) => {
    const nextForm = {
      ...form,
      validForm: inForm.validForm,
      fastqInspection: null,
    }
    if (inForm.validForm) {
      nextForm.fileInput = inForm.fileInput
      nextForm.fileInput_display = inForm.fileInput_display
      nextForm.fileInput_source = inForm.fileInput_source
    } else {
      inspectionRun.current += 1
      nextForm.fileInput = []
      nextForm.fileInput_display = []
      nextForm.fileInput_source = []
    }
    setState(nextForm)
    setDoValidation((value) => value + 1)
    inspectSelectedFastq(nextForm)
  }

  useEffect(() => {
    //set paired
    if (props.isPaired != null && form.platform.toLowerCase() === 'illumina') {
      setNewState2('paired', props.isPaired)
    }
  }, [props.isPaired]) // eslint-disable-line react-hooks/exhaustive-deps

  //trigger validation method when input changes
  useEffect(() => {
    //force updating parent's inputParams
    props.setParams(form, props.name)
  }, [doValidation]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <MessageDialog
        isOpen={inspectionNotice.isOpen}
        title="FASTQ detected settings"
        html={true}
        message={inspectionNotice.message}
        handleClickClose={() =>
          setInspectionNotice({
            isOpen: false,
            message: '',
          })
        }
      />
      {props.text && (
        <MyTooltip
          id={`fileInputTooltip-${props.name}`}
          tooltip={props.tooltip}
          text={props.text}
          place={props.tooltipPlace ? props.tooltipPlace : defaults.tooltipPlace}
          color={props.tooltipColor ? props.tooltipColor : defaults.tooltipColor}
          showTooltip={props.showTooltip ? props.showTooltip : defaults.showTooltip}
        />
      )}
      {props.seqPlatformOptions && (
        <>
          <OptionSelector
            id={'platform'}
            name={'platform'}
            setParams={setPlatform}
            text={props.seqPlatformText}
            options={props.seqPlatformOptions}
            defaultValue={form.platform}
            display={form.platform_display}
            tooltip={props.seqPlatformTooltip}
          />
          <br></br>
        </>
      )}
      {!props.disableSwitcher && form.platform.toLowerCase() === 'illumina' && (
        <>
          <Switcher
            id={'paired'}
            name={'paired'}
            setParams={setSwitcher}
            text={
              props.pairedText ? props.pairedText : components[componentName].params['paired'].text
            }
            defaultValue={form.paired}
            trueText={components[componentName].params['paired'].trueText}
            falseText={components[componentName].params['paired'].falseText}
          />
          <br></br>
        </>
      )}

      {!form.paired && (
        <>
          <FileInputArray
            setParams={setFileInput}
            name={'fastq'}
            text={`${capitalizeFirstLetter(form.platform)} ${components[componentName].params['fastq'].text}`}
            enableInput={props.enableInput}
            placeholder={props.placeholder}
            isValidFileInput={props.isValidFileInput}
            dataSources={props.dataSources}
            fileTypes={props.fileTypes}
            projectTypes={props.projectTypes}
            projectScope={props.projectScope}
            viewFile={props.viewFile}
            isOptional={props.isOptional}
            cleanupInput={props.cleanupInput}
            maxInput={props.maxInput}
          />
        </>
      )}
      {form.paired && (
        <>
          <PairedFileInputArray
            setParams={setFileInput}
            name={'fastq'}
            text={`${capitalizeFirstLetter(form.platform)} ${components[componentName].params['fastq'].text}`}
            enableInput={props.enableInput}
            placeholder={props.placeholder}
            isValidFileInput={props.isValidFileInput}
            dataSources={props.dataSources}
            fileTypes={props.fileTypes}
            projectTypes={props.projectTypes}
            projectScope={props.projectScope}
            viewFile={props.viewFile}
            isOptional={props.isOptional}
            cleanupInput={props.cleanupInput}
            maxInput={props.maxInput}
          />
        </>
      )}
    </>
  )
}
