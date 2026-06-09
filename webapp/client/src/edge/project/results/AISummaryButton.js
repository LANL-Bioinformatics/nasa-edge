import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { Alert, Button, Modal, ModalBody, ModalFooter, ModalHeader, Spinner } from 'reactstrap'
import CIcon from '@coreui/icons-react'
import { cilList } from '@coreui/icons'
import { apis, postData } from 'src/edge/common/util'
import config from 'src/config'

const getSummaryUrl = (project, userType, isAdmin, isAuthenticated) => {
  if (isAdmin || userType === 'admin') {
    return `${apis.adminProjects}/${project.code}/aiSummary`
  }

  if (isAuthenticated || userType === 'user') {
    return `${apis.userProjects}/${project.code}/aiSummary`
  }

  return `${apis.publicProjects}/${project.code}/aiSummary`
}

const formatSummaryTime = (value) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

export const AISummaryButton = ({ sectionKey, title, project, userType }) => {
  const user = useSelector((state) => state.user)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState('')
  const [summaryModel, setSummaryModel] = useState('')
  const [summaryUpdated, setSummaryUpdated] = useState('')
  const [error, setError] = useState('')
  const isProjectOwner = user?.profile?.email && project?.owner === user.profile.email
  const isAdmin = user?.profile?.role === 'admin'
  const isAuthenticated = user?.isAuthenticated

  if (!config.AI_SUMMARY.IS_ENABLED || (!isProjectOwner && !isAdmin)) {
    return null
  }

  const generateSummary = async (regenerate = false) => {
    setIsOpen(true)
    setError('')
    setLoading(true)

    try {
      const data = await postData(
        getSummaryUrl(project, userType, isAdmin, isAuthenticated),
        {
          sectionKey,
          title,
          regenerate,
        },
      )
      setSummary(data.summary)
      setSummaryModel(data.model || '')
      setSummaryUpdated(data.updated || '')
    } catch (requestError) {
      setSummary('')
      setSummaryModel('')
      setSummaryUpdated('')
      setError(requestError.message || 'Unable to generate the AI summary.')
    } finally {
      setLoading(false)
    }
  }

  const handleButtonClick = (event) => {
    event.stopPropagation()
    setIsOpen(true)

    if (!summary && !error) {
      generateSummary()
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        color="outline-primary"
        className="edge-ai-summary-button"
        title={
          summary || error ? `Open AI summary for ${title}` : `Generate AI summary for ${title}`
        }
        disabled={loading}
        onClick={handleButtonClick}
      >
        {loading ? <Spinner size="sm" /> : <CIcon icon={cilList} />}
        <span className="edge-ai-summary-button-label">AI Summary</span>
      </Button>
      <Modal isOpen={isOpen} toggle={() => setIsOpen(!isOpen)} centered size="lg">
        <ModalHeader toggle={() => setIsOpen(!isOpen)}>{title} AI Summary</ModalHeader>
        <ModalBody>
          {loading && (
            <div className="edge-ai-summary-loading">
              <Spinner size="sm" />
              <span>Generating summary...</span>
            </div>
          )}
          {error && <Alert color="danger">{error}</Alert>}
          {summary && (
            <>
              {(summaryModel || summaryUpdated) && (
                <p className="edge-ai-summary-meta text-muted">
                  {summaryModel ? `AI model: ${summaryModel}` : ''}
                  {summaryModel && summaryUpdated ? ' | ' : ''}
                  {summaryUpdated ? `Generated: ${formatSummaryTime(summaryUpdated)}` : ''}
                </p>
              )}
              <p className="edge-ai-summary-text">{summary}</p>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="primary"
            size="sm"
            onClick={() => generateSummary(true)}
            disabled={loading}
          >
            {summary ? 'Regenerate' : 'Generate'}
          </Button>
          <Button color="secondary" size="sm" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}

export default AISummaryButton
