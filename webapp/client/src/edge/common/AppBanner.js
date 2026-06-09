import { useState, useEffect } from 'react'
import { Card, CardBody, CardText, CardTitle } from 'reactstrap'
import { MdInfo } from 'react-icons/md'
import { HtmlText } from './HtmlText'
import { getData, apis } from './util'

const AppBanner = (props) => {
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    getData(apis.announcement)
      .then((data) => {
        if (data.announcement) {
          setAnnouncement(data.announcement)
        } else {
          setAnnouncement('')
        }
      })
      .catch((err) => {
        setAnnouncement('')
      })
  }, [])

  return (
    <span>
      {announcement ? (
        <div className="edge-app-banner">
          <Card color="info" inverse>
            <CardBody>
              <MdInfo size={28} /> <b>Announcement</b>
              <br></br>
              <HtmlText text={announcement} />
            </CardBody>
          </Card>
        </div>
      ) : (
        <></>
      )}
    </span>
  )
}

export default AppBanner
