import React, { useEffect, useState } from 'react'
import { Button } from 'reactstrap'
import { LoaderDialog, FileViewerDialog } from '/src/edge/common/Dialogs'
import { getData, fetchFile, apis } from '/src/edge/common/util'
import ProjectGeneral from '/src/edge/project/results/ProjectGeneral'
import ProjectOutputs from '/src/edge/project/results/ProjectOutputs'
import { AmpIllumina } from '../nasa/results/AmpIllumina'

const ProjectResult = (props) => {
  const [project, setProject] = useState()
  const [type, setType] = useState()
  const [runStats, setRunStats] = useState()
  const [conf, setConf] = useState()
  const [result, setResult] = useState()
  const [outputs, setOutputs] = useState()
  const [confLoading, setConfLoading] = useState(false)
  const [runStatsLoading, setRunStatsLoading] = useState(false)
  const [resultLoading, setResultLoading] = useState(false)
  const [outputLoading, setOutputLoading] = useState(false)
  const [error, setError] = useState()
  const [view_log_file, setView_log_file] = useState(false)
  const [log_file_content, setLog_file_content] = useState('')
  const [allExpand, setAllExpand] = useState(0)
  const [allClosed, setAllClosed] = useState(0)
  //disable the expand | close
  const disableExpandClose = false

  useEffect(() => {
    setProject(props.project)
    setType(props.type)
  }, [props.project, props.type])

  useEffect(() => {
    const getProjectConf = () => {
      let url = `${apis.publicProjects}/${project.code}/conf`
      if (type === 'admin') {
        url = `${apis.adminProjects}/${project.code}/conf`
      } else if (type === 'user') {
        url = `${apis.userProjects}/${project.code}/conf`
      }
      getData(url)
        .then((data) => {
          //console.log(data)
          setConfLoading(false)
          setConf(data.conf)
        })
        .catch((error) => {
          setConfLoading(false)
          alert(JSON.stringify(error))
          setError(error)
        })
    }
    const getProjectRunStats = () => {
      let url = `${apis.publicProjects}/${project.code}/runStats`
      if (type === 'admin') {
        url = `${apis.adminProjects}/${project.code}/runStats`
      } else if (type === 'user') {
        url = `${apis.userProjects}/${project.code}/runStats`
      }
      getData(url)
        .then((data) => {
          //console.log(data)
          setRunStatsLoading(false)
          setRunStats(data.runStats)
        })
        .catch((error) => {
          setRunStatsLoading(false)
          alert(JSON.stringify(error))
          setError(error)
        })
    }
    const getProjectResult = () => {
      let url = `${apis.publicProjects}/${project.code}/result`
      if (type === 'admin') {
        url = `${apis.adminProjects}/${project.code}/result`
      } else if (type === 'user') {
        url = `${apis.userProjects}/${project.code}/result`
      }
      getData(url)
        .then((data) => {
          //console.log(data.result)
          setResultLoading(false)
          setResult(data.result)
        })
        .catch((error) => {
          setResultLoading(false)
          alert(JSON.stringify(error))
          setError(error)
        })
    }

    const getProjectOutputs = () => {
      let url = `${apis.publicProjects}/${project.code}/outputs`
      if (type === 'admin') {
        url = `${apis.adminProjects}/${project.code}/outputs`
      } else if (type === 'user') {
        url = `${apis.userProjects}/${project.code}/outputs`
      }
      //project files
      getData(url)
        .then((data) => {
          //console.log(data.fileData)
          setOutputLoading(false)
          setOutputs(data.fileData)
        })
        .catch((error) => {
          setOutputLoading(false)
          alert(JSON.stringify(error))
          setError(error)
        })
    }

    if (project && project.code) {
      setConfLoading(true)
      getProjectConf()
      setRunStatsLoading(true)
      getProjectRunStats()
      if (project.status === 'complete') {
        setResultLoading(true)
        getProjectResult()
        setOutputLoading(true)
        getProjectOutputs()
      }
    }
  }, [project, type])

  const viewLogFile = () => {
    let url = '/projects/' + project.code + '/log.txt'
    fetchFile(url)
      .then((data) => {
        setLog_file_content(data)
        setView_log_file(true)
      })
      .catch((error) => {
        alert(error)
      })
  }

  const onLogChange = (data) => {
    setLog_file_content(data)
  }

  return (
    <div className="animated fadeIn">
      <LoaderDialog
        loading={confLoading || runStatsLoading || resultLoading || outputLoading}
        text="Loading..."
      />
      <FileViewerDialog
        type={'text'}
        isOpen={view_log_file}
        toggle={(e) => setView_log_file(!view_log_file)}
        title={'log.txt'}
        src={log_file_content}
        onChange={onLogChange}
      />

      {error ? (
        <div className="clearfix">
          <p className="text-muted float-left">
            The project might be deleted or you have no permission to access it.
          </p>
        </div>
      ) : (
        <>
          {project && project.status === 'failed' && props.type !== 'public' && (
            <>
              <Button type="button" size="sm" color="primary" onClick={viewLogFile}>
                View Log
              </Button>
              <br></br>
              <br></br>
            </>
          )}
          {(outputs || result) && !disableExpandClose && (
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
          <ProjectGeneral
            stats={runStats}
            conf={conf}
            project={project}
            title={'General'}
            userType={type}
            allExpand={allExpand}
            allClosed={allClosed}
          />
          {result && (
            <>
              {project.type === 'AmpIllumina' && (
                <AmpIllumina
                  result={result}
                  project={project}
                  userType={type}
                  allExpand={allExpand}
                  allClosed={allClosed}
                />
              )}
            </>
          )}
          {outputs && (
            <ProjectOutputs
              outputs={outputs}
              filePath={'/projects/' + project.code + '/output'}
              allExpand={allExpand}
              allClosed={allClosed}
            />
          )}
          <br></br>
          <br></br>
        </>
      )}
    </div>
  )
}

export default ProjectResult
