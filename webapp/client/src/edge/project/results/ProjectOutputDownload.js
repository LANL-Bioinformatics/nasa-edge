import { useState, useMemo } from 'react'
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap'
import DropdownTreeSelect from 'react-dropdown-tree-select'
import 'react-dropdown-tree-select/dist/styles.css'
import { LoaderDialog, MessageDialog } from 'src/edge/common/Dialogs'
import { postData, apis } from '/src/edge/common/util'

export const ProjectOutputDownload = (props) => {
  const [submitting, setSubmitting] = useState(false)
  const [fileSelected, setFileSelected] = useState([])
  const [openSuccessDialog, setOpenSuccessDialog] = useState(false)
  const [openErrorDialog, setOpenErrorDialog] = useState(false)
  const [downloadMsg, setDownloadMsg] = useState('')

  const treeSelectorSearchPredicate = (node, searchTerm) => {
    //return node.label && node.label.toLowerCase().startsWith(searchTerm)
    return node.label && node.label.toLowerCase().indexOf(searchTerm) >= 0
  }

  const treeSelector = useMemo(
    () => (
      <DropdownTreeSelect
        id={'output-tree-select'}
        data={props.outputTreeData}
        searchPredicate={treeSelectorSearchPredicate}
        className="edge-dropdown-tree-select"
        texts={{ placeholder: 'Search/Select folders/files to download ...' }}
        clearSearchOnChange={false}
        keepOpenOnSelect={true}
        keepTreeOnSearch={true}
        keepChildrenOnSearch={true}
        mode="multiSelect"
        showPartiallySelected={false}
        showDropdown="always"
        onChange={(currentNode, selectedNodes) => onChangeFiles(currentNode, selectedNodes)}
      />
    ),
    [props.outputTreeData],
  )

  const onChangeFiles = (currentNode, selectedNodes) => {
    //console.log('onChange::', currentNode, selectedNodes)
    if (!currentNode.label) {
      return
    }
    let files = []
    selectedNodes.map((item) => {
      files.push({ id: item.id, value: item.value })
    })
    setFileSelected(files)
  }

  const zipFiles = () => {
    if (fileSelected.length === 0) {
      alert('Please select files/folders to download')
      return
    }
    setSubmitting(true)
    let filePaths = []
    fileSelected.forEach((file) => {
      //use relative path to zip files in output folder
      filePaths.push(file.id)
    })
    let url = `${apis.publicProjects}/${props.project.code}/downloadOutputs`
    if (props.type === 'admin') {
      url = `${apis.adminProjects}/${props.project.code}/downloadOutputs`
    } else if (props.type === 'user') {
      url = `${apis.userProjects}/${props.project.code}/downloadOutputs`
    }
    postData(url, { filePaths: filePaths })
      .then((data) => {
        setSubmitting(false)
        props.closeModal()
        setFileSelected([])
        //disable this, use popup to open the download link
        // setDownloadMsg(
        //   'Please click the link <a href="' +
        //     `${apis.tmp}${data.zipUrl}` +
        //     '" target="_blank">here</a> to download the zip file. ',
        // )
        //setOpenSuccessDialog(true)

        //open the download link in new tab
        //have to change browser settings to allow popups, otherwise it will be blocked by browser security policy
        window.open(`${apis.tmp}${data.zipUrl}`, '_blank')
      })
      .catch((err) => {
        setSubmitting(false)
        setFileSelected([])
        setOpenErrorDialog(true)
      })
  }

  return (
    <>
      <LoaderDialog loading={submitting === true} text="Zipping files..." />
      <MessageDialog
        className="modal-sm modal-danger"
        title="Error!"
        isOpen={openErrorDialog}
        html={true}
        message={
          'Failed to zip outputs. Please select smaller number of files or folders to download.'
        }
        handleClickClose={() => setOpenErrorDialog(false)}
      />
      <MessageDialog
        className="modal-sm modal-success"
        title="Success!"
        isOpen={openSuccessDialog}
        html={true}
        message={downloadMsg}
        handleClickClose={() => setOpenSuccessDialog(false)}
      />
      <Modal isOpen={props.isOpen} size="lg" centered>
        <ModalBody className="justify-content-center" style={{ height: '600px' }}>
          {treeSelector}
        </ModalBody>
        <ModalFooter className="justify-content-center">
          <Button
            disabled={fileSelected.length === 0 ? true : false}
            size="sm"
            color="primary"
            type="submit"
            onClick={() => zipFiles()}
          >
            Download Outputs
          </Button>{' '}
          <Button
            size="sm"
            color="secondary"
            onClick={() => {
              setFileSelected([])
              props.closeModal()
            }}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
