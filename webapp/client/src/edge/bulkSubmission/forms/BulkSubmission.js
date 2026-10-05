import { useState, useEffect } from 'react'
import { Button, Form, Row, Col } from 'reactstrap'
import { useNavigate, NavLink } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { workflowList } from 'src/util'

import { getData, postData, notify, apis } from '../../common/util'
import { LoaderDialog, MessageDialog } from '../../common/Dialogs'
import MySelect from '../../common/MySelect'
import { Project } from '../../project/forms/Project'
import { FileUpload } from '../../project/forms/FileUpload'

const HtmlToReactParser = require('html-to-react').Parser
let htmlToReactParser = new HtmlToReactParser()

const BulkSubmission = (props) => {
  const navigate = useNavigate()
  const [openDialog, setOpenDialog] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [sysMsg, setSysMsg] = useState()
  const [submitting, setSubmitting] = useState(false)
  const [requestSubmit, setRequestSubmit] = useState(false)
  const [projectParams, setProjectParams] = useState()
  const [uploadParams, setUploadParams] = useState()
  const [doValidation, setDoValidation] = useState(0)

  const [workflow, setWorkflow] = useState(props.workflowOptions[0].value)

  //callback function for child component
  const setProject = (params) => {
    //console.log('main project:', params)
    setProjectParams(params)
    setDoValidation(doValidation + 1)
  }
  //callback function for child component
  const setFileUpload = (params) => {
    //console.log("main fileupload:", params)
    setUploadParams(params)
    setDoValidation(doValidation + 1)
  }

  const closeMsgModal = () => {
    setOpenDialog(false)
  }
  //submit button clicked
  const onSubmit = () => {
    setSubmitting(true)

    let formData = new FormData()
    formData.append(
      'bulkSubmission',
      JSON.stringify({
        name: projectParams.projectName,
        desc: projectParams.projectDesc,
        type: workflow,
      }),
    )

    let inputDisplay = {}
    inputDisplay.type = workflowList[workflow].label
    inputDisplay.input = {}
    formData.append('file', uploadParams.file)
    formData.append('bulkfile', JSON.stringify({ name: uploadParams.file.name }))
    inputDisplay.input['Bulk Excel File'] = uploadParams.file.name

    formData.append('inputDisplay', JSON.stringify(inputDisplay))

    //console.log("formdata", JSON.stringify(workflowParams))
    postData(apis.userBulkSubmissions, formData)
      .then((data) => {
        setSubmitting(false)
        // prevent multiple submission
        setRequestSubmit(false)
        notify('success', 'Your bulk submission request was submitted successfully!', 2000)
        setTimeout(() => navigate('/user/bulkSubmissions'), 2000)
      })
      .catch((error) => {
        setSubmitting(false)
        alert(error)
      })
  }

  useEffect(() => {
    setRequestSubmit(true)

    if (projectParams && !projectParams.validForm) {
      setRequestSubmit(false)
    }
    if (uploadParams && !uploadParams.validForm) {
      setRequestSubmit(false)
    }
  }, [doValidation]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDoValidation(doValidation + 1)
  }, [workflow]) // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [])

  return (
    <div
      className="animated fadeIn"
      style={disabled ? { pointerEvents: 'none', opacity: '0.4' } : {}}
    >
      <span className="edge-workflow-tag pt-3 text-muted edge-text-size-small">{props.tag}</span>
      <Row className="justify-content-center">
        <Col xs="12" md="12">
          <ToastContainer />
          <LoaderDialog loading={submitting === true} text="Submitting..." />
          <MessageDialog
            className="modal-lg modal-warning"
            title="System Message"
            isOpen={openDialog}
            html={true}
            message={'<div><b>' + sysMsg + '</b></div>'}
            handleClickClose={closeMsgModal}
          />
          <Form
            onSubmit={(e) => {
              e.preventDefault()
            }}
          >
            <div className="clearfix">
              <h4 className="pt-3">Bulk Submission</h4>
              <hr />
              <Project
                setParams={setProject}
                projectNameText={props.projectNameText ? props.projectNameText : 'Name'}
                projectNamePattern={props.projectNamePattern ? props.projectNamePattern : null}
                projectNameTooltip={props.projectNameTooltip ? props.projectNameTooltip : null}
                projectNameErrMessage={
                  props.projectNameErrMessage ? props.projectNameErrMessage : null
                }
                projectNameTooltipClickable={
                  props.projectNameTooltipClickable ? props.projectNameTooltipClickable : false
                }
                projectDescText={props.projectDescText ? props.projectDescText : 'Description'}
                projectDescIsOptional={
                  props.projectDescIsOptional ? props.projectDescIsOptional : true
                }
                projectDescTooltip={props.projectDescTooltip ? props.projectDescTooltip : null}
                projectDescTooltipClickable={
                  props.projectDescTooltipClickable ? props.projectDescTooltipClickable : false
                }
                projectDescErrMessage={
                  props.projectDescErrMessage ? props.projectDescErrMessage : null
                }
                projectDescIsValidTextInput={
                  props.projectDescIsValidTextInput ? props.projectDescIsValidTextInput : false
                }
              />
              <br></br>
              <b>Workflow</b>
              {props.workflowOptions.length > 1 ? (
                <>
                  <MySelect
                    defaultValue={props.workflowOptions[0]}
                    options={props.workflowOptions}
                    onChange={(e) => {
                      if (e) {
                        setWorkflow(e.value)
                      } else {
                        setWorkflow()
                      }
                    }}
                    placeholder="Select a Workflow..."
                    isClearable={true}
                  />
                </>
              ) : (
                <>
                  <br></br>
                  {props.workflowOptions[0].label}
                </>
              )}
              <br></br>
              {workflow && (
                <>
                  {workflowList[workflow] && workflowList[workflow].info ? (
                    <>
                      {workflowList[workflow].doclink ? (
                        <>
                          {htmlToReactParser.parse(workflowList[workflow].info)} &nbsp;
                          <a
                            target="_blank"
                            href={workflowList[workflow].doclink}
                            rel="noopener noreferrer"
                          >
                            Learn more
                          </a>
                          <br></br>
                        </>
                      ) : (
                        <>
                          {htmlToReactParser.parse(workflowList[workflow].info)} &nbsp;
                          <br></br>
                        </>
                      )}
                    </>
                  ) : (
                    <></>
                  )}
                  <span className="pt-3 text-muted edge-text-size-small">
                    NOTE: All input files in the Bulk Excel File must be uploaded to the{' '}
                    <NavLink to="/user/uploads">My Uploads</NavLink> before submission.
                  </span>
                  <br></br>
                  Download Excel{' '}
                  <a
                    style={{ color: 'blue', textDecoration: 'underline' }}
                    rel="noreferrer"
                    href={`${apis.workflowDocs}/bulkSubmission/${workflowList[workflow].bulk_submission_template}`}
                  >
                    Template
                  </a>
                  <br></br>
                  <br></br>
                  <FileUpload
                    setParams={setFileUpload}
                    text="Bulk Excel File"
                    tooltip={
                      workflowList[workflow]['bulk_file_tip']
                        ? workflowList[workflow]['bulk_file_tip']
                        : 'Required'
                    }
                    accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  />
                  <br></br>
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
        </Col>
      </Row>
    </div>
  )
}

export default BulkSubmission
