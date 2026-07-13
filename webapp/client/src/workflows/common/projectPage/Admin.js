import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import ProjectSummary from '/src/edge/project/results/ProjectSummary'
import { LoaderDialog } from '/src/edge/common/Dialogs'
import { getData, apis } from '/src/edge/common/util'
import ProjectResult from '../ProjectResult'

const Admin = (props) => {
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const [code, setCode] = useState()
  const [project, setProject] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState()
  const user = useSelector((state) => state.user)

  useEffect(() => {
    if (user.profile.role !== 'admin') {
      navigate('/home')
    } else {
      const codeParam = params.get('code')
      if (codeParam) {
        setCode(codeParam)
      } else {
        navigate('/admin/projects')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const getProject = () => {
      let url = `${apis.adminProjects}/${code}`
      getData(url)
        .then((data) => {
          setProject({ ...data.project, report: data.report })
          setLoading(false)
        })
        .catch((err) => {
          setError('Failed to load project')
          setLoading(false)
        })
    }
    if (code) {
      setLoading(true)
      getProject()
    }
  }, [code])

  return (
    <div className="animated fadeIn">
      <LoaderDialog loading={loading} text="Loading..." />
      {error ? (
        <div className="clearfix">
          <h4 className="pt-3">Project not found</h4>
          <hr />
          <p className="text-muted float-left">
            The project might be deleted or you have no permission to acces it.
          </p>
        </div>
      ) : (
        <>
          <ProjectSummary project={project} type={'admin'} />
          <br></br>
          <ProjectResult project={project} type={'admin'} />
        </>
      )}
    </div>
  )
}

export default Admin
