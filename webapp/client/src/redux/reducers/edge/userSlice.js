import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { jwtDecode } from 'jwt-decode'

import { setAuthToken, postData, putData, apis } from 'src/edge/common/util'
import { setSubmittingForm } from '../pageSlice'
import { addMessage, cleanMessage, addError, cleanError } from '../messageSlice'
import config from 'src/config'

const initialState = {
  isAuthenticated: false,
  profile: null,
}

export const userSlice = createSlice({
  name: 'user',
  initialState,
  // The `reducers` field lets us define reducers and generate associated actions
  reducers: {
    // Use the PayloadAction type to declare the contents of `action.payload`
    setUser: (state, action) => {
      state.isAuthenticated = action.payload.isAuthenticated
      state.profile = action.payload.profile
    },
    logout: (state) => {
      // Remove token from local storage
      localStorage.removeItem('jwtToken')
      // Remove auth header for future requests
      setAuthToken(false)
      // Set current user to empty object {} which will set isAuthenticated to false
      state.isAuthenticated = false
      state.profile = null
    },
  },
})

export const { setUser, logout } = userSlice.actions

// The function below is called a thunk and allows us to perform async logic. It
// can be dispatched like a regular action.
const registerAsync = createAsyncThunk('user/register', async (userData, { dispatch }) => {
  try {
    await postData(apis.register, userData)
    dispatch(addMessage({ register: userData.message }))
    dispatch(setSubmittingForm(false))
  } catch (err) {
    if (typeof err === 'string') {
      dispatch(addError({ register: err }))
    } else {
      if (err.error) {
        dispatch(addError(err.error))
      } else {
        dispatch(addError({ register: 'API server error' }))
      }
    }
    dispatch(setSubmittingForm(false))
  }
})

const loginAsync = createAsyncThunk('user/login', async (userData, { dispatch }) => {
  try {
    let url = apis.login
    if (userData.oauth) {
      url = apis.oauthLogin
    }
    const data = await postData(url, userData)
    // Save to localStorage
    // Set token to localStorage
    const token = data.token
    localStorage.setItem('jwtToken', token)
    // Set token to Auth header
    setAuthToken(token)
    // Decode token to get user data
    const decoded = jwtDecode(token)
    // Set current user
    dispatch(
      setUser({
        isAuthenticated: true,
        profile: decoded,
      }),
    )
    dispatch(setSubmittingForm(false))
  } catch (err) {
    if (typeof err === 'string') {
      dispatch(addError({ login: err ? err : 'API server error' }))
    } else {
      if (err.error) {
        dispatch(addError(err.error))
      } else {
        dispatch(addError({ login: 'API server error' }))
      }
    }
    dispatch(setSubmittingForm(false))
  }
})

const activateAsync = createAsyncThunk('user/activate', async (userData, { dispatch }) => {
  try {
    await putData(apis.activate, userData)
    dispatch(addMessage({ activate: config.UM.REGISTER_MSG }))
    dispatch(setSubmittingForm(false))
  } catch (err) {
    if (typeof err === 'string') {
      dispatch(addError({ activate: err }))
    } else {
      if (err.error) {
        dispatch(addError(err.error))
      } else {
        dispatch(addError({ activate: 'API server error' }))
      }
    }
    dispatch(setSubmittingForm(false))
  }
})

const getActivationLinkAsync = createAsyncThunk(
  'user/getActivationLink',
  async (userData, { dispatch }) => {
    try {
      await postData(apis.getActivationLink, userData)
      dispatch(addMessage({ getActivationLink: config.UM.ACTIVATIONLINK_MSG }))
      dispatch(setSubmittingForm(false))
    } catch (err) {
      if (typeof err === 'string') {
        dispatch(addError({ getActivationLink: err }))
      } else {
        if (err.error) {
          dispatch(addError(err.error))
        } else {
          dispatch(addError({ getActivationLink: 'API server error' }))
        }
      }
      dispatch(setSubmittingForm(false))
    }
  },
)

const resetPasswordAsync = createAsyncThunk(
  'user/resetPassword',
  async (userData, { dispatch }) => {
    try {
      await putData(apis.resetPassword, userData)
      dispatch(
        addMessage({
          resetPassword: config.UM.RESETPASSWORD_MSG,
        }),
      )
      dispatch(setSubmittingForm(false))
    } catch (err) {
      if (typeof err === 'string') {
        dispatch(addError({ resetPassword: err }))
      } else {
        if (err.error) {
          dispatch(addError(err.error))
        } else {
          dispatch(addError({ resetPassword: 'API server error' }))
        }
      }
      dispatch(setSubmittingForm(false))
    }
  },
)

const getResetPasswordLinkAsync = createAsyncThunk(
  'user/getResetPasswordLink',
  async (userData, { dispatch }) => {
    try {
      await postData(apis.getResetPasswordLink, userData)
      dispatch(addMessage({ getResetPasswordLink: config.UM.RESETPASSWORDLINK_MSG }))
      dispatch(setSubmittingForm(false))
    } catch (err) {
      if (typeof err === 'string') {
        dispatch(addError({ getResetPasswordLink: err }))
      } else {
        if (err.error) {
          dispatch(addError(err.error))
        } else {
          dispatch(addError({ getResetPasswordLink: 'API server error' }))
        }
      }
      dispatch(setSubmittingForm(false))
    }
  },
)

const updateAsync = createAsyncThunk('user/update', async (userData, { dispatch }) => {
  try {
    const data = await putData(apis.userUpdate, userData)
    // Save to localStorage
    // Set token to localStorage
    const token = data.token
    localStorage.setItem('jwtToken', token)
    // Set token to Auth header
    setAuthToken(token)
    // Decode token to get user data
    const decoded = jwtDecode(token)
    // Set current user
    dispatch(
      setUser({
        isAuthenticated: true,
        profile: decoded,
      }),
    )

    dispatch(setSubmittingForm(false))
  } catch (err) {
    console.log('ERR', err)
    if (typeof err === 'string') {
      dispatch(addError({ update: err }))
    } else {
      if (err.error) {
        dispatch(addError(err.error))
      } else {
        dispatch(addError({ update: 'API server error' }))
      }
    }
    dispatch(setSubmittingForm(false))
  }
})

const updateProjectAsync = createAsyncThunk(
  'user/updateProject',
  async (projData, { dispatch }) => {
    try {
      await putData(`${apis.userProjects}/${projData.code}`, projData)
    } catch (err) {
      if (typeof err === 'string') {
        dispatch(addError({ [projData.code]: err }))
      } else {
        if (err.error) {
          dispatch(addError({ [projData.code]: JSON.stringify(err.error) }))
        } else {
          dispatch(addError({ [projData.code]: 'API server error' }))
        }
      }
    }
  },
)

const updateBulkSubmissionAsync = createAsyncThunk(
  'user/updateBulkSubmission',
  async (bulkData, { dispatch }) => {
    try {
      await putData(`${apis.userBulkSubmissions}/${bulkData.code}`, bulkData)
    } catch (err) {
      if (typeof err === 'string') {
        dispatch(addError({ [bulkData.code]: err }))
      } else {
        if (err.error) {
          dispatch(addError({ [bulkData.code]: JSON.stringify(err.error) }))
        } else {
          dispatch(addError({ [bulkData.code]: 'API server error' }))
        }
      }
    }
  },
)

const updateUploadAsync = createAsyncThunk(
  'user/updateUpload',
  async (uploadData, { dispatch }) => {
    try {
      await putData(`${apis.userUploads}/${uploadData.code}`, uploadData)
    } catch (err) {
      if (typeof err === 'string') {
        dispatch(addError({ [uploadData.code]: err }))
      } else {
        if (err.error) {
          dispatch(addError({ [uploadData.code]: JSON.stringify(err.error) }))
        } else {
          dispatch(addError({ [uploadData.code]: 'API server error' }))
        }
      }
    }
  },
)

// We can also write thunks by hand, which may contain both sync and async logic.
export const register = (userData) => (dispatch, getState) => {
  dispatch(cleanMessage())
  dispatch(cleanError())
  dispatch(setSubmittingForm(true))
  dispatch(registerAsync(userData))
}

export const login = (userData) => (dispatch, getState) => {
  dispatch(cleanMessage())
  dispatch(cleanError())
  dispatch(setSubmittingForm(true))
  dispatch(loginAsync(userData))
}

export const update = (userData) => (dispatch, getState) => {
  dispatch(cleanMessage())
  dispatch(cleanError())
  dispatch(setSubmittingForm(true))
  dispatch(updateAsync(userData))
}

export const activate = (userData) => (dispatch, getState) => {
  dispatch(cleanMessage())
  dispatch(cleanError())
  dispatch(setSubmittingForm(true))
  dispatch(activateAsync(userData))
}

export const getActivationLink = (userData) => (dispatch, getState) => {
  dispatch(cleanMessage())
  dispatch(cleanError())
  dispatch(setSubmittingForm(true))
  dispatch(getActivationLinkAsync(userData))
}

export const resetPassword = (userData) => (dispatch, getState) => {
  dispatch(cleanMessage())
  dispatch(cleanError())
  dispatch(setSubmittingForm(true))
  dispatch(resetPasswordAsync(userData))
}

export const getResetPasswordLink = (userData) => (dispatch, getState) => {
  dispatch(cleanMessage())
  dispatch(cleanError())
  dispatch(setSubmittingForm(true))
  dispatch(getResetPasswordLinkAsync(userData))
}

export const updateProject = (projData) => (dispatch, getState) => {
  dispatch(updateProjectAsync(projData))
}

export const updateBulkSubmission = (bulkData) => (dispatch, getState) => {
  dispatch(updateBulkSubmissionAsync(bulkData))
}

export const updateUpload = (uploadData) => (dispatch, getState) => {
  dispatch(updateUploadAsync(uploadData))
}

export default userSlice.reducer
