import React, { useState, useEffect } from 'react'
import { Card, CardBody, Collapse, Button } from 'reactstrap'
import { FcFolder, FcOpenedFolder } from 'react-icons/fc'
import FileBrowser from 'react-keyed-file-browser'
import 'react-keyed-file-browser/dist/react-keyed-file-browser.css'
import JsFileDownloader from 'js-file-downloader'
import JSZip from 'jszip'
import JSZipUtils from 'jszip-utils'
import FileSaver from 'file-saver'
import { LoaderDialog } from '../../common/Dialogs'
import { Header } from './CardHeader'
import config from 'src/config'
import { ProjectOutputDownload } from './ProjectOutputDownload'

//list all files in a project directory
const ProjectOutputs = (props) => {
  const [loading, setLoading] = useState(false)
  const [collapseCard, setCollapseCard] = useState(true)
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)

  const handleSelectedFile = (file) => {
    //open file in new tab
    openInNewTab(config.APP.API_URI + file.url)
  }

  const handleDownloadFile = (file) => {
    const url = props.filePath + file
    new JsFileDownloader({
      url: url,
    })
      .then(() => {
        // Called when download ended
      })
      .catch((error) => {
        // Called when an error occurred
        alert(error)
      })
  }

  const handleDownloadFolder = (folder) => {
    var zip = new JSZip()
    //get all files/sub-dirs-files in the folder
    let files = props.outputs.filter((item) => {
      return item.key.startsWith('/' + folder)
    })

    //check folder size
    let size = 0
    let doDownload = true
    files.forEach((file) => {
      size += file.size
      if (size > config.APP.MAX_FOLDER_SIZE_BYTES) {
        doDownload = false
      }
    })

    if (doDownload) {
      setLoading(true)
      let count = 0

      files.forEach((file) => {
        //fetch file content and add to zip file
        JSZipUtils.getBinaryContent(file.url, (err, data) => {
          if (err) {
            alert(err)
          }
          try {
            zip.file(file.key.replace('/' + folder, ''), data, { binary: true })
            count++
            if (count === files.length) {
              zip.generateAsync({ type: 'blob' }).then((content) => {
                FileSaver.saveAs(content, folder[0].replace(/\/$/, ''))
                setLoading(false)
              })
            }
          } catch (err2) {
            setLoading(false)
            alert(err2)
          }
        })
      })
    } else {
      alert("Failed to download '" + folder + "': folder exceeded the max download size.")
    }
  }

  const toggleOutputs = () => {
    setCollapseCard(!collapseCard)
  }

  const openInNewTab = (url) => {
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer')
    if (newWindow) newWindow.opener = null
  }

  useEffect(() => {
    if (props.allExpand > 0) {
      setCollapseCard(false)
    }
  }, [props.allExpand])

  useEffect(() => {
    if (props.allClosed > 0) {
      setCollapseCard(true)
    }
  }, [props.allClosed])

  return (
    <Card className="workflow-result-card">
      <ProjectOutputDownload
        type={props.type}
        isOpen={downloadModalOpen}
        project={props.project}
        outputTreeData={props.outputTreeData}
        closeModal={() => setDownloadModalOpen(false)}
      />
      <Header
        toggle={true}
        toggleParms={toggleOutputs}
        title={'Outputs'}
        collapseParms={collapseCard}
      />
      <Collapse isOpen={!collapseCard}>
        <CardBody>
          <LoaderDialog loading={loading === true} text="Zipping files..." />
          <div className="edge-right">
            <Button
              color="primary"
              size="sm"
              className="rounded-pill"
              onClick={() => setDownloadModalOpen(true)}
              outline
            >
              &nbsp;Download Outputs&nbsp;
            </Button>
          </div>
          <FileBrowser
            files={props.outputs}
            icons={{
              Folder: <FcFolder className={'edge-fab-file-selector-icon'} />,
              FolderOpen: <FcOpenedFolder className={'edge-fab-file-selector-icon'} />,
            }}
            showActionBar={false}
            canFilter={false}
            showFoldersOnFilter={true}
            onSelectFile={handleSelectedFile}
            noFilesMessage={'No outputs'}
            onDownloadFile={handleDownloadFile}
            onDownloadFolder={handleDownloadFolder}
            //disable default detailRender
            detailRenderer={(e) => {
              return null
            }}
          />
          <br></br>
          <br></br>
        </CardBody>
      </Collapse>
    </Card>
  )
}

export default ProjectOutputs
