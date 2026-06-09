import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'

import { login } from 'src/redux/reducers/edge/userSlice'
import { cleanMessage, cleanError } from 'src/redux/reducers/messageSlice'
import config from 'src/config'

// no input form
// just a placeholder for registering single user and logging in with that user,
// then redirect to the location specified in `location.state.from` (or to "/home" if that is not specified)
const SingleLogin = (props) => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const user = useSelector((state) => state.user)
  const loginErrors = useSelector((state) => state.message.errors)
  const messages = useSelector((state) => state.message.messages)

  useEffect(() => {
    dispatch(cleanMessage())
    dispatch(cleanError())
    const userData = {
      firstName: 'single',
      lastName: 'user',
      email: config.APP.SINGLE_USER_EMAIL,
      password: config.APP.SINGLE_USER_PASSWORD,
      oauth: 'single',
    }
    dispatch(login(userData))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user.isAuthenticated) {
      if (location.state) {
        navigate(location.state.from)
      } else {
        navigate('/home')
      }
    }
  }, [user, navigate, location])

  return (
    <>
      {messages.login && <span className="red-text">{messages.login}</span>}
      {loginErrors.login && <span className="red-text">{loginErrors.login}</span>}
    </>
  )
}

export default SingleLogin
