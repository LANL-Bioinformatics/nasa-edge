const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const vm = require('node:vm')
const path = require('node:path')

// Exercise session policy without requiring the browser or the UI dependencies.
function setup(pathname = '/projects') {
  const storage = new Map([['jwtToken', 'old-token']])
  const redirects = []
  const context = vm.createContext({
    jwtDecode: JSON.parse,
    URL,
    Date,
    localStorage: {
      removeItem: (key) => storage.delete(key),
      setItem: (key, value) => storage.set(key, value),
    },
    window: {
      location: {
        origin: 'https://example.org',
        pathname,
        replace: (url) => redirects.push(url),
      },
    },
  })
  const source = readFileSync(path.join(__dirname, '../src/edge/common/session.js'), 'utf8')
    .replace(/^import .*\n/gm, '')
    .replace(/export const /g, 'var ')
  vm.runInContext(source, context)
  return { context, storage, redirects }
}

test('restores only tokens with a finite future expiry', () => {
  const { context } = setup()
  const exp = Date.now() / 1000 + 3600
  assert.equal(context.readSession(JSON.stringify({ exp })).exp, exp)
  for (const token of [null, 'malformed', '{}', 'null', '{"exp":"9999999999"}', '{"exp":0}']) {
    assert.equal(context.readSession(token), null)
  }
  assert.equal(context.readSession(JSON.stringify({ exp: Date.now() / 1000 })), null)
})

test('redirects once, clears the session and preserves the return path', () => {
  const { context, storage, redirects } = setup()
  context.redirectToLogin()
  context.redirectToLogin()
  assert.equal(storage.has('jwtToken'), false)
  assert.equal(storage.get('loginFrom'), '/projects')
  assert.deepEqual(redirects, ['/login'])
  assert.equal(context.isRedirectingToLogin(), true)
})

test('does not reload the login page', () => {
  const { context, storage, redirects } = setup('/login')
  context.redirectToLogin()
  assert.equal(storage.has('jwtToken'), false)
  assert.deepEqual(redirects, [])
})

test('handles only same-origin protected APIs, preserving login and public errors', () => {
  const { context } = setup()
  for (const url of ['/api/auth-user/info', '/api/admin/users', 'https://example.org/api/admin']) {
    assert.equal(context.isProtectedRequest(url), true)
  }
  for (const url of ['/api/user/login', '/api/user/oauthLogin', '/api/public/projects',
    'https://other.org/api/auth-user/info', undefined]) {
    assert.equal(context.isProtectedRequest(url), false)
  }
})

test('401 interceptor clears the auth header and redirects while preserving rejection', async () => {
  const { context, redirects } = setup()
  let onError
  context.axios = {
    defaults: { headers: { common: { Authorization: 'old-token' } } },
    interceptors: { response: { use: (_, error) => { onError = error } } },
  }
  let source = readFileSync(path.join(__dirname, '../src/edge/common/util.js'), 'utf8')
  source = source.slice(source.indexOf('// set token'), source.indexOf('// post data'))
    .replace(/export const /g, 'var ')
  vm.runInContext(source, context)
  const loginError = { response: { status: 401 }, config: { url: '/api/user/login' } }
  await assert.rejects(onError(loginError), (err) => err === loginError)
  assert.deepEqual(redirects, [])
  const serverError = { response: { status: 500 }, config: { url: '/api/auth-user/info' } }
  await assert.rejects(onError(serverError), (err) => err === serverError)
  assert.deepEqual(redirects, [])
  const rejectedSession = { response: { status: 401 }, config: { url: '/api/auth-user/info' } }
  await assert.rejects(onError(rejectedSession), (err) => err === rejectedSession)
  assert.equal(context.axios.defaults.headers.common.Authorization, undefined)
  assert.deepEqual(redirects, ['/login'])
})
