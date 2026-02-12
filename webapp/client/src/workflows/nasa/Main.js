import React, { useState, useEffect } from 'react'
import { Button, Form } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { workflowList } from 'src/util'
import { postData, getData, notify, apis, isValidFileInput } from 'src/edge/common/util'
import { LoaderDialog, MessageDialog } from 'src/edge/common/Dialogs'
import { Project } from 'src/edge/project/forms/Project'
import { HtmlText } from 'src/edge/common/HtmlText'
import { AmpIllumina } from './forms/AmpIllumina'
import { workflowOptions, workflows } from './defaults'

const Main = (props) => {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [requestSubmit, setRequestSubmit] = useState(false)
  const [projectParams, setProjectParams] = useState()
  const [selectedWorkflows, setSelectedWorkflows] = useState({})
  const [doValidation, setDoValidation] = useState(0)
  const [workflow, setWorkflow] = useState(workflowOptions[0].value)
  const [openDialog, setOpenDialog] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [sysMsg, setSysMsg] = useState()
  const [allExpand, setAllExpand] = useState(0)
  const [allClosed, setAllClosed] = useState(0)
  //disable the expand | close
  const disableExpandClose = true

  //callback function for child component
  const setProject = (params) => {
    //console.log('main project:', params)
    setProjectParams(params)
    setDoValidation(doValidation + 1)
  }
  const setWorkflowParams = (params, workflowName) => {
    console.log(workflowName, params)
    setSelectedWorkflows({ ...selectedWorkflows, [workflowName]: params })
    setDoValidation(doValidation + 1)
  }

  //submit button clicked
  const onSubmit = () => {
    setSubmitting(true)
    let formData = {}
    formData.category = workflowList[workflow].category
    // set project info
    formData.project = {
      name: projectParams.projectName,
      desc: projectParams.projectDesc,
      type: workflow,
    }
    // set workflow inputs
    let myWorkflow = { name: workflow, input: {} }
    // set workflow input display
    let inputDisplay = {}
    inputDisplay[workflowList[workflow].label] = {}

    Object.keys(selectedWorkflows[workflow].inputs).forEach((key) => {
      myWorkflow.input[key] = selectedWorkflows[workflow].inputs[key].value
      if (selectedWorkflows[workflow].inputs[key].display) {
        inputDisplay[[workflowList[workflow].label]][selectedWorkflows[workflow].inputs[key].text] =
          selectedWorkflows[workflow].inputs[key].display
      } else {
        inputDisplay[[workflowList[workflow].label]][selectedWorkflows[workflow].inputs[key].text] =
          selectedWorkflows[workflow].inputs[key].value
      }
    })

    // set form data
    formData.workflow = myWorkflow
    formData.inputDisplay = inputDisplay

    // files used for caculating total input size on server side
    formData.files = [...selectedWorkflows[workflow].files]

    // submit to server via api
    postData(apis.userProjects, formData)
      .then((data) => {
        setSubmitting(false)
        notify('success', 'Your workflow request was submitted successfully!', 2000)
        setTimeout(() => navigate('/user/projects'), 2000)
      })
      .catch((error) => {
        setSubmitting(false)
        alert(error)
      })
  }

  const closeMsgModal = () => {
    setOpenDialog(false)
  }

  useEffect(() => {
    setRequestSubmit(true)

    if (projectParams && !projectParams.validForm) {
      setRequestSubmit(false)
    }

    if (
      !workflow ||
      !selectedWorkflows[workflow] ||
      (selectedWorkflows[workflow] && !selectedWorkflows[workflow].validForm)
    ) {
      setRequestSubmit(false)
    }
  }, [doValidation]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let url = apis.userInfo
    getData(url)
      .then((data) => {
        if (data.info.allowNewRuns) {
          setDisabled(false)
        } else {
          setSysMsg(data.info.message)
          setDisabled(true)
          setOpenDialog(true)
        }
      })
      .catch((err) => {
        alert(err)
      })
  }, [props])

  return (
    <div
      className="animated fadeIn"
      style={disabled ? { pointerEvents: 'none', opacity: '0.4' } : {}}
    >
      <MessageDialog
        className="modal-lg modal-danger"
        title="System Message"
        isOpen={openDialog}
        html={true}
        message={'<div><b>' + sysMsg + '</b></div>'}
        handleClickClose={closeMsgModal}
      />
      <span className="pt-3 text-muted edge-text-size-small">Nasa | AmpIllumina Workflow </span>
      <ToastContainer />
      <LoaderDialog loading={submitting === true} text="Submitting..." />
      <Form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <div className="clearfix">
          <h4 className="pt-3">Run AmpIllumina Workflow</h4>
          <hr />
          <Project setParams={setProject} />

          <br></br>
          {workflow && workflowList[workflow].info && (
            <div className="pt-3 text-muted edge-text-size-small">
              <HtmlText text={workflowList[workflow].info} />
              <br></br>
            </div>
          )}
          <br></br>
          {!disableExpandClose && (
            <>
              <div className="float-end edge-text-size-small">
                <Button
                  style={{ fontSize: 12, paddingBottom: '5px' }}
                  size="sm"
                  className="btn-pill"
                  color="ghost-primary"
                  onClick={() => setAllExpand(allExpand + 1)}
                >
                  expand
                </Button>
                &nbsp; | &nbsp;
                <Button
                  style={{ fontSize: 12, paddingBottom: '5px' }}
                  size="sm"
                  className="btn-pill"
                  color="ghost-primary"
                  onClick={() => setAllClosed(allClosed + 1)}
                >
                  close
                </Button>
                &nbsp; all sections &nbsp;
              </div>
              <br></br>
              <br></br>
            </>
          )}
          {workflow === 'AmpIllumina' && (
            <>
              <AmpIllumina
                name={workflow}
                full_name={workflow}
                title={workflowList[workflow].label}
                setParams={setWorkflowParams}
                isValid={
                  selectedWorkflows[workflow] ? selectedWorkflows[workflow].validForm : false
                }
                errMessage={
                  selectedWorkflows[workflow] ? selectedWorkflows[workflow].errMessage : null
                }
                allExpand={allExpand}
                allClosed={allClosed}
              />
            </>
          )}
        </div>

        <div className="edge-center">
          <Button
            color="primary"
            onClick={(e) => onSubmit()}
            disabled={!workflow || !requestSubmit}
          >
            Submit
          </Button>{' '}
        </div>
        <br></br>
        <br></br>
      </Form>
    </div>
  )
}

export default Main
