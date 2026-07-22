import { Badge } from 'reactstrap'
import dayjs from 'dayjs'
import { IoMdDownload } from 'react-icons/io'
import { useSelector } from 'react-redux'

import { bulkSubmissionStatusColors, bulkSubmissionStatusNames } from '../../um/common/tableUtil'
import { workflowList } from 'src/util'
import config from 'src/config'

const BulkSubmissionSummary = (props) => {
  const user = useSelector((state) => state.user)
  const fileUrl = `/bulksubmissions/${props.bulkSubmission.code}/${props.bulkSubmission.filename}`

  return (
    <>
      {!props.bulkSubmission ? (
        <div className="clearfix">
          <h4 className="pt-3">BulkSubmission not found</h4>
          <hr />
          <p className="text-muted float-left">
            The bulkSubmission might be deleted or you have no permission to acces it.
          </p>
        </div>
      ) : (
        <div className="clearfix">
          <h4 className="pt-3">{props.bulkSubmission.name}</h4>
          <hr />
          <b>BulkSubmission Summary:</b>
          <hr></hr>
          <b>Description:</b> {props.bulkSubmission.desc}
          <br></br>
          {props.type !== 'public' && (
            <>
              <b>Owner:</b> {props.bulkSubmission.owner}
              <br></br>
            </>
          )}
          <b>Submission Time:</b>{' '}
          {dayjs(props.bulkSubmission.created).format('dddd, MMMM D, YYYY h:mm A')}
          <br></br>
          <b>Status:</b>{' '}
          <Badge color={bulkSubmissionStatusColors[props.bulkSubmission.status]}>
            {bulkSubmissionStatusNames[props.bulkSubmission.status]}
          </Badge>
          <br></br>
          {config.APP.SUPPORT_IS_ENABLED && props.bulkSubmission.status === 'failed' && (
            <span className="edge-help-text">
              {props.type === 'user' && props.bulkSubmission.owner === user.profile.email && (
                <>
                  If you need assistance with this failed bulkSubmission, please contact{' '}
                  {config.APP.SUPPORT_EMAIL} and include the bulkSubmission code '
                  {props.bulkSubmission.code}'.
                  <br></br>
                </>
              )}
            </span>
          )}
          <b>Type:</b>{' '}
          {props.bulkSubmission.type ? workflowList[props.bulkSubmission.type].label : ''}
          <br></br>
          <b>File:</b> {props.bulkSubmission.filename} &nbsp;&nbsp;
          <a href={fileUrl}>
            <IoMdDownload />
          </a>
          <br></br>
        </div>
      )}
    </>
  )
}

export default BulkSubmissionSummary
