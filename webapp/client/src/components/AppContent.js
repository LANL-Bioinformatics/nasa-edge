import React, { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CContainer, CSpinner } from '@coreui/react'
import { Row, Col } from 'reactstrap'

import PrivateRoute from 'src/edge/common/PrivateRoute'
// routes config
import routes from 'src/edge/common/routes'
import privateRoutes from 'src/edge/common/private-routes'
import workflowRoutes from 'src/workflows/common/routes'
import workflowPrivateRoutes from 'src/workflows/common/private-routes'

const AppContent = () => {
  return (
    <CContainer className="px-4" lg>
      <Suspense fallback={<CSpinner color="primary" />}>
        <Row className="justify-content-center">
          <Col xs="12" md="12" lg="12">
            <Routes>
              {routes.map((route, idx) => {
                return (
                  route.element && (
                    <Route
                      key={idx}
                      path={route.path}
                      exact={route.exact}
                      name={route.name}
                      element={<route.element />}
                    />
                  )
                )
              })}
              {workflowRoutes.map((route, idx) => {
                return (
                  route.element && (
                    <Route
                      key={idx}
                      path={route.path}
                      exact={route.exact}
                      name={route.name}
                      element={<route.element />}
                    />
                  )
                )
              })}
              {privateRoutes.map((route, idx) => {
                return (
                  route.element && (
                    <Route
                      key={idx}
                      path={route.path}
                      exact={route.exact}
                      name={route.name}
                      element={
                        <PrivateRoute>
                          <route.element />
                        </PrivateRoute>
                      }
                    />
                  )
                )
              })}
              {workflowPrivateRoutes.map((route, idx) => {
                return (
                  route.element && (
                    <Route
                      key={idx}
                      path={route.path}
                      exact={route.exact}
                      name={route.name}
                      element={
                        <PrivateRoute>
                          <route.element />
                        </PrivateRoute>
                      }
                    />
                  )
                )
              })}

              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </Col>
        </Row>
      </Suspense>
    </CContainer>
  )
}

export default React.memo(AppContent)
