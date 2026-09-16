import React from 'react'

const PublicProjectPage = React.lazy(() => import('src/workflows/common/projectPage/Public'))
const Home = React.lazy(() => import('src/workflows/nasa/Home'))

const workflowRoutes = [
  { path: '/public/project', name: 'PublicProjectPage', element: PublicProjectPage },
  { path: '/home', name: 'Home', element: Home },
]

export default workflowRoutes
