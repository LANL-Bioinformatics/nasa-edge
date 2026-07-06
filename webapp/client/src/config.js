/**
 * Configure the app based upon environment variables.
 *
 * This module acts as an interface between the process environment variables (i.e. `import.meta.env.*`)
 * and the modules that consume their values. This (a) facilitates validation of their values and
 * the assignment of default/fallback values; and (b) reduces the number of occurrences of `import.meta.env.*`
 * variables throughout the codebase, which can be sources of errors as some IDEs do not validate their
 * existence during development, since, at that time, they do not exist as JavaScript symbols.
 *
 * References:
 * - https://nodejs.org/en/learn/command-line/how-to-read-environment-variables-from-nodejs
 * - https://developer.mozilla.org/en-US/docs/Glossary/Falsy
 */

/**
 * Returns a local URI based upon the specified parameters; and the current protocol and domain.
 *
 * References:
 * - https://developer.mozilla.org/en-US/docs/Web/API/Location/protocol
 * - https://developer.mozilla.org/en-US/docs/Web/API/Location/host
 *
 * @param path {string} The path portion of the URI
 * @return {string} The resulting local URI
 */
const makeLocalUri = (path = '') => {
  const protocol = window.location.protocol // e.g. "http:" or "https:"
  const host = window.location.host // e.g. "www.example.com" or "www.example.com:1234"

  // If the path is non-empty and lacks a leading slash, prepend one.
  const sanitizedPath = path.length > 0 && path.charAt(0) !== '/' ? `/${path}` : path

  return `${protocol}//${host}${sanitizedPath}`
}

/**
 * Returns the value resolved to an integer; or `undefined` if the original value is `undefined`.
 *
 * References: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt
 *
 * Examples:
 * f("123")     => 123
 * f("xyz")     => NaN (which is a Falsy value)
 * f(undefined) => undefined
 *
 * @param val {string|undefined} The value you want to resolve to an integer
 * @return {number|undefined} The integer, or `undefined`
 */
const makeIntIfDefined = (val) => {
  return typeof val === 'string' ? parseInt(val, 10) : undefined
}

/**
 * Returns `true` if the value matches "true" (ignoring letter casing); otherwise, returns `false`.
 *
 * Examples:
 * - f("TrUe") => true
 * - f("1")    => false
 *
 * @param val {string} The string you want to resolve to a Boolean value
 * @return {boolean} The Boolean value
 */
const makeBoolean = (val = '', name) => {
  return typeof val === 'string' ? /^true$/i.test(val) : false
}

/**
 * Returns an ORCiD Auth URI based upon the specified parameters.
 *
 * References:
 * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
 *
 * @param redirectUri {string} URI to which you want ORCiD to redirect the client after authenticating
 * @param orcidClientId {string} ORCiD `client_id` obtained from the ORCiD Developer Tools web page
 * @param nonceVal {string} Nonce value we can use to verify that the redirected client originated here
 * @param orcidAuthBaseUri {string} ORCiD oAuth base URI
 * @return {string} The resulting ORCiD Auth URI
 */
const makeOrcidAuthUri = (
  redirectUri,
  orcidClientId,
  nonceVal = 'whatever',
  orcidAuthBaseUri = 'https://orcid.org/oauth/authorize',
) => {
  const sanitizedRedirectUri = encodeURIComponent(redirectUri)
  const sanitizedOrcidClientId = encodeURIComponent(orcidClientId)
  const sanitizedNonceVal = encodeURIComponent(nonceVal)
  return `${orcidAuthBaseUri}?response_type=token&redirect_uri=${sanitizedRedirectUri}&client_id=${sanitizedOrcidClientId}&scope=openid&nonce=${sanitizedNonceVal}`
}

const config = {
  APP: {
    // The user-facing name of the application.
    NAME: import.meta.env.VITE_NAME || 'EDGE',
    // Note about the distribution of this application. Can be shown in the login page.
    DISTRIBUTION_NOTE: import.meta.env.VITE_DISTRIBUTION_NOTE,
    // user/password authentication
    USER_AUTH_IS_ENABLED: makeBoolean(import.meta.env.VITE_USER_AUTH_ENABLED),
    // Boolean flag indicating whether the client is configured for single-user deployments, and should be disabled in multi-user deployments.
    // Note: When this flag is `true`, the client will automatically register a single user with the email "singleuser@my.edge"
    // and will redirect user to the location specified in `location.state.from` (or to "/home" if that is not specified)
    // and the VITE_USER_AUTH_ENABLED and VITE_ORCID_AUTH_ENABLED flags will be ignored. This is useful for single-user deployments, where you want to disable user registration and authentication features, and automatically log in a single user.
    SINGLE_USER_MODE_IS_ENABLED: makeBoolean(import.meta.env.VITE_SINGLE_USER_MODE_ENABLED),
    // single-user mode credentials. User can login with these credentials when the single-user mode is disabled.
    SINGLE_USER_EMAIL: import.meta.env.VITE_SINGLE_USER_EMAIL || 'singleuser@my.edge',
    SINGLE_USER_PASSWORD: import.meta.env.VITE_SINGLE_USER_PASSWORD || 'pw4SU@edge',
    // Boolean flag indicating whether the client will request that the server send emails to the user.
    EMAIL_IS_ENABLED: makeBoolean(import.meta.env.VITE_EMAIL_NOTIFICATION_ENABLED),
    // Boolean flag indicating whether the client has bulk submission features enabled.
    BULK_SUBMISSIONS_IS_ENABLED: makeBoolean(import.meta.env.VITE_BULK_SUBMISSIONS_ENABLED),
    // Boolean flag indicating whether the client will allow user to upload files.
    UPLOAD_IS_ENABLED: makeBoolean(import.meta.env.VITE_FILEUPLOAD_ENABLED),
    // Boolean flag indicating whether the client will allow user to upload files into folders.
    UPLOAD_FOLDER_IS_ENABLED: makeBoolean(import.meta.env.VITE_FILEUPLOAD_FOLDER_ENABLED),
    // Boolean flag indicating whether the client will allow user to download SRA Data.
    SRADATA_IS_ENABLED: makeBoolean(import.meta.env.VITE_SRADATA_ENABLED),
    // Boolean flag indicating whether the client will offer support.
    SUPPORT_IS_ENABLED: makeBoolean(import.meta.env.VITE_SUPPORT_ENABLED),
    SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL || 'edge@lanl.gov',
    // Base URI at which visitors can access the application.
    // Note: This is written under the assumption that the client and API server share a domain.
    BASE_URI: makeLocalUri(),
    API_URI: import.meta.env.VITE_API_URL || makeLocalUri(),
    // Maximum size of folder (in Bytes) the client will allow visitors to download.
    // Note: 1610612740 Bytes is 1.5 Gibibytes (1.6 Gigabytes).
    // Reference: https://www.xconvert.com/unit-converter/bytes-to-gigabytes
    MAX_FOLDER_SIZE_BYTES:
      makeIntIfDefined(import.meta.env.VITE_FOLDER_DOWNLOAD_MAX_SIZE) || 1610612740,
  },
  ORCID: {
    // Boolean flag indicating whether the client will offer ORCiD-based authentication.
    IS_ENABLED: makeBoolean(import.meta.env.VITE_ORCID_AUTH_ENABLED),
    // ORCiD Auth URI, which contains the ORCiD Client ID.
    // Note: You can get the ORCiD Client ID value from: https://orcid.org/developer-tools
    AUTH_URI: makeOrcidAuthUri(makeLocalUri('/oauth'), import.meta.env.VITE_ORCID_CLIENT_ID),
  },
  AI_SUMMARY: {
    IS_ENABLED: makeBoolean(import.meta.env.VITE_AI_SUMMARY_ENABLED),
  },
  UM: {
    REGISTER_MSG: 'Congratulations! Your account has been created successfully.',
    REGISTER_MSG_EMAIL:
      'Congratulations! Your account has been created successfully. Please check your email to activate your account.',
    ACTIVATE_MSG: 'Congratulations! Your account has been activated successfully.',
    ACTIVATIONLINK_MSG: 'Please check your email to activate your account.',
    RESETPASSWORD_MSG: 'Congratulations! Your password has been updated successfully.',
    RESETPASSWORDLINK_MSG: 'Please check your email to reset your password.',
  },
}

export default config
