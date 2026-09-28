import React, { Suspense, useEffect, useState } from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'

import { CSpinner, useColorModes } from '@coreui/react'
import './scss/style.scss'

import { setUser, logout } from 'src/redux/reducers/edge/userSlice'
import { readSession, redirectToLogin } from 'src/edge/common/session'
import { setAuthToken } from 'src/edge/common/util'

// Containers
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))

const App = () => {
  const { isColorModeSet, setColorMode } = useColorModes('')
  const storedTheme = useSelector((state) => state.theme)
  const dispatch = useDispatch()
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // setColorMode(storedTheme)
    setColorMode('light')
    const token = localStorage.getItem('jwtToken')
    const profile = readSession(token)
    if (profile) {
      setAuthToken(token)
      dispatch(setUser({ isAuthenticated: true, profile }))
    } else {
      dispatch(logout())
      if (token) redirectToLogin()
    }
    setSessionReady(true)
    //logout all tabs
    const handleStorage = (e) => {
      if (e.key === 'jwtToken' && e.oldValue && !e.newValue) {
        dispatch(logout())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!sessionReady) return <CSpinner color="primary" variant="grow" />

  return (
    <Router>
      <Suspense
        fallback={
          <div className="pt-3 text-center">
            <CSpinner color="primary" variant="grow" />
          </div>
        }
      >
        <Routes>
          <Route path="*" name="Home" element={<DefaultLayout />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App
