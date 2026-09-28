import { jwtDecode } from 'jwt-decode'

export const readSession = (token) => {
  if (!token) return null
  try {
    const profile = jwtDecode(token)
    return Number.isFinite(profile.exp) && profile.exp > Date.now() / 1000 ? profile : null
  } catch {
    return null
  }
}

let redirecting = false
export const isRedirectingToLogin = () => redirecting

export const redirectToLogin = () => {
  localStorage.removeItem('jwtToken')
  if (redirecting || window.location.pathname === '/login') return
  redirecting = true
  localStorage.setItem('loginFrom', window.location.pathname)
  window.location.replace('/login')
}

export const isProtectedRequest = (url) => {
  try {
    const target = new URL(url, window.location.origin)
    return (
      target.origin === window.location.origin &&
      /^\/api\/(auth-user|admin)(\/|$)/.test(target.pathname)
    )
  } catch {
    return false
  }
}
