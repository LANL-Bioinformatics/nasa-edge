import { Badge } from 'reactstrap'
import dayjs from 'dayjs'

import { useSelector } from 'react-redux'
import { projectStatusColors, projectStatusNames } from '../../um/common/tableUtil'
import { workflowList } from 'src/util'
import config from 'src/config'

const ProjectSummary = (props) => {
  const user = useSelector((state) => state.user)
  return (
    <>
      {!props.project ? (
        <div className="clearfix">
          <h4 className="pt-3">Project not found</h4>
          <hr />
          <p className="text-muted float-left">
            The project might be deleted or you have no permission to acces it.
          </p>
        </div>
      ) : (
        <div className="clearfix">
          <h4 className="pt-3">{props.project.name}</h4>
          <hr />
          <b>Project Summary</b>
          <hr></hr>
          <b>Description:</b> {props.project.desc}
          <br></br>
          {props.type !== 'public' && (
            <>
              <b>Owner:</b> {props.project.owner}
              <br></br>
            </>
          )}
          <b>Submission Time:</b> {dayjs(props.project.created).format('dddd, MMMM D, YYYY h:mm A')}
          <br></br>
          <b>Status:</b>{' '}
          <Badge color={projectStatusColors[props.project.status]}>
            {projectStatusNames[props.project.status]}
          </Badge>
          <br></br>
          {config.APP.SUPPORT_IS_ENABLED && props.project.status === 'failed' && (
            <span className="edge-help-text">
              {props.type === 'user' && props.project.owner === user.profile.email && (
                <>
                  If you need assistance with this failed project, please contact{' '}
                  {config.APP.SUPPORT_EMAIL} and include the project code '{props.project.code}'.
                  <br></br>
                </>
              )}
            </span>
          )}
          <b>Type:</b> {props.project.type ? workflowList[props.project.type].label : ''}
          <br></br>
        </div>
      )}
    </>
  )
}

export default ProjectSummary
