import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { setSidebar } from '../redux/reducers/coreuiSlice'

import { CSidebar, CSidebarBrand, CSidebarFooter, CSidebarHeader } from '@coreui/react'

import { AppSidebarNav } from './AppSidebarNav'

import logo from 'src/assets/brand/logo-sidebar.png'

// sidebar nav config
import navigation from '../_nav'

const AppSidebar = () => {
  const dispatch = useDispatch()
  const unfoldable = useSelector((state) => state.coreui.sidebarUnfoldable)
  const sidebarShow = useSelector((state) => state.coreui.sidebarShow)

  return (
    <CSidebar
      className="border-end"
      colorScheme="dark"
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => {
        dispatch(setSidebar(visible))
      }}
    >
      <CSidebarHeader>
        <CSidebarBrand to="/">
          <span className="sidebar-brand-full">
            <img alt="logo" style={{ width: 100, height: 48 }} src={logo} />
          </span>
          <span className="sidebar-brand-narrow">
            <img alt="logo" style={{ width: 10, height: 10 }} src={logo} />
          </span>
        </CSidebarBrand>
      </CSidebarHeader>
      <AppSidebarNav items={navigation} />
      <CSidebarFooter className="border-top d-none d-lg-flex"> EDGE V3 </CSidebarFooter>
    </CSidebar>
  )
}

export default React.memo(AppSidebar)
