/* eslint-disable prettier/prettier */
import React from 'react'
import config from 'src/config'

const PublicProjects = React.lazy(() => import('src/edge/um/public/Projects'))
const UserLogin = React.lazy(() => import('src/edge/um/user/Login'))
const SingleLogin = React.lazy(() => import('src/edge/um/user/SingleLogin'))
const OAuth = React.lazy(() => import('src/edge/um/user/OrcidLogin'))
const UserRegister = React.lazy(() => import('src/edge/um/user/Register'))
const UserActivate = React.lazy(() => import('src/edge/um/user/Activate'))
const UserResetPassword = React.lazy(() => import('src/edge/um/user/ResetPassword'))

const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/public/projects', name: 'PublicProjects', element: PublicProjects },
  config.APP.SINGLE_USER_MODE_IS_ENABLED && { path: '/login', name: 'SingleLogin', element: SingleLogin },
  !config.APP.SINGLE_USER_MODE_IS_ENABLED && config.ORCID.IS_ENABLED && { path: '/oauth', name: 'OAuth', element: OAuth },
  // user/password login
  { path: '/register', exact: true, name: 'Register', element: UserRegister },
  config.APP.USER_AUTH_IS_ENABLED && {
    path: '/login',
    exact: true,
    name: 'Login',
    element: UserLogin,
  },
  !config.APP.SINGLE_USER_MODE_IS_ENABLED && config.APP.USER_AUTH_IS_ENABLED && config.APP.EMAIL_IS_ENABLED && {
    path: '/activate',
    exact: true,
    name: 'Activate',
    element: UserActivate,
  },
  !config.APP.SINGLE_USER_MODE_IS_ENABLED && config.APP.USER_AUTH_IS_ENABLED && config.APP.EMAIL_IS_ENABLED && {
    path: '/resetPassword',
    exact: true,
    name: 'ResetPassword',
    element: UserResetPassword,
  },
]

export default routes
