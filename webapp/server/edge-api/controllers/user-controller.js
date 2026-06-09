const randomize = require('randomatic')
const bcrypt = require('bcryptjs')
const User = require('../models/user')
const { encodePassword, signToken } = require('../utils/user')
const { userActionSender } = require('../../mailers/senders')
const logger = require('../../utils/logger')
const config = require('../../config')

const sysError = config.APP.API_ERROR

// Send out action link to user
const getActionLink = async (req, res, action) => {
  try {
    const data = req.body
    // Find user by email
    const user = await User.findOne({ email: { $eq: data.email } })
    // Check if user exists
    if (!user) {
      logger.error(`${action}: Account ${data.emaill} not found`)
      return res.status(400).json({
        error: { [action]: `Account ${data.email} not found` },
        message: 'Action failed',
        success: false,
      })
    }
    // Is active user?
    if (action === 'getActivationLink' && user.active) {
      logger.error(
        `${action}: Account ${data.email} has already been activated.`,
      )
      return res.status(400).json({
        error: { [action]: 'Your account has already been activated.' },
        message: 'Action failed',
        success: false,
      })
    }
    if (action === 'getResetPasswordLink' && !user.active) {
      logger.error(`${action}: Account ${data.email} is not active.`)
      return res.status(400).json({
        error: { [action]: 'Your account is not active.' },
        message: 'Action failed',
        success: false,
      })
    }

    // Send out an activation link if the URL of the activation page provided.
    if (data.actionURL && !data.test) {
      const link = `${data.actionURL}?email=${user.email}&token=${encodeURIComponent(user.password)}`
      userActionSender(user.email, action, user.firstName, link)
    }
    // success
    return res.json({
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`${action} failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Insert new user and send out activation link to user if user's status is not active
const register = async (req, res) => {
  try {
    const data = req.body
    logger.debug(`/api/user/register: ${JSON.stringify(data.email)}`)
    // check if the email alreay exists
    const user = await User.findOne({ email: { $eq: data.email } })
    if (user) {
      logger.debug(`Registration failed: Email ${data.email} already exists`)
      return res.status(400).json({
        error: { email: `Email ${data.email} already exists` },
        message: 'Action failed',
        success: false,
      })
    }
    // encode password and add new user to DB
    const hashedPassword = await encodePassword(data.password)
    const code = randomize('0', 6)
    const newUser = new User({
      ...data,
      password: hashedPassword,
      code,
      notification: { email: data.email },
    })

    await newUser.save()
    logger.info('Registration successful')
    // Send out an activation link if the URL of the activation page provided.
    if (!newUser.active && data.actionURL && !data.test) {
      const link = `${data.actionURL}?email=${newUser.email}&token=${encodeURIComponent(newUser.password)}`
      userActionSender(
        newUser.email,
        'getActivationLink',
        newUser.firstName,
        link,
      )
    }
    // success
    const result = {
      message: 'Action successful',
      success: true,
    }
    // return user for other api tests
    if (data.test) {
      result.user = newUser
    }
    return res.json(result)
  } catch (err) {
    logger.error(`Registration failed: ${err}`)
    // Delete the new user if exists
    await User.deleteOne({ email: req.body.email })

    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Set user's status to active
const activate = async (req, res) => {
  try {
    const data = req.body
    logger.debug(`/api/user/activate: ${JSON.stringify(data)}`)
    // find user
    const user = await User.findOne({ email: { $eq: data.email } })

    // Check if user exists
    if (!user) {
      logger.error(`activate: Account ${data.emaill} not found`)
      return res.status(400).json({
        error: { activate: `Account ${data.email} not found` },
        message: 'Action failed',
        success: false,
      })
    }
    // Is active user
    if (user.active) {
      logger.error(
        `activate: Account ${data.email} has already been activated.`,
      )
      return res.status(400).json({
        error: { activate: 'Your account has already been activated.' },
        message: 'Action failed',
        success: false,
      })
    }

    // Not a valid token
    if (user.password !== data.token) {
      logger.error('activate: Invalid token')
      return res.status(400).json({
        error: { activate: 'Invalid token.' },
        message: 'Action failed',
        success: false,
      })
    }

    // Activate user
    await User.updateOne({ email: data.email }, { active: true })
    logger.info('Activation successful')
    return res.json({
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Activation failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Send out activation link to user
const getActivationLink = async (req, res) => {
  logger.debug(`/api/user/getActivationLink: ${JSON.stringify(req.body)}`)
  getActionLink(req, res, 'getActivationLink')
}

// Set user's password
const resetPassword = async (req, res) => {
  try {
    const data = req.body
    logger.debug(`/api/user/resetPassword: ${JSON.stringify(data)}`)
    // find user
    const user = await User.findOne({ email: { $eq: data.email } })
    // Check if user exists
    if (!user) {
      logger.error(`resetPassword: Account ${data.emaill} not found`)
      return res.status(400).json({
        error: { resetPassword: `Account ${data.email} not found` },
        message: 'Action failed',
        success: false,
      })
    }
    // Not active user
    if (!user.active) {
      logger.error(`resetPassword: Account ${data.email} is not active.`)
      return res.status(400).json({
        error: { resetPassword: 'Your account is not active.' },
        message: 'Action failed',
        success: false,
      })
    }
    // Not a valid token
    if (user.password !== data.token) {
      logger.error('resetPassword: Invalid token')
      return res.status(400).json({
        error: { resetPassword: 'Invalid token.' },
        message: 'Action failed',
        success: false,
      })
    }
    // Hash password before saving in database
    const hashedPassword = await encodePassword(data.newPassword)
    // change code
    const code = randomize('0', 6)
    await User.updateOne(
      { email: data.email },
      { password: hashedPassword },
      { code },
    )
    logger.info('ResetPassword successful')
    return res.json({
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`ResetPassword failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Send out activation link to user
const getResetPasswordLink = async (req, res) => {
  logger.debug(`/api/user/getResetPasswordLink: ${JSON.stringify(req.body)}`)
  getActionLink(req, res, 'getResetPasswordLink')
}

// Authenticate user by validating email and password. Return a Bearer token fo valid user.
const login = async (req, res) => {
  try {
    const data = req.body
    logger.debug(`/api/user/login: ${JSON.stringify(data.email)}`)
    // Find user by email
    const user = await User.findOneAndUpdate(
      { email: { $eq: data.email } },
      { $set: { lastLogin: new Date() } },
      { new: true },
    )
    // Check if user exists
    if (!user) {
      logger.error(`login: Account ${data.emaill} not found`)
      return res.status(400).json({
        error: { login: `Account ${data.email} not found` },
        message: 'Action failed',
        success: false,
      })
    }
    // Is active user?
    if (!user.active) {
      logger.error(`login: Account ${data.email} is not active.`)
      return res.status(400).json({
        error: { login: 'Your account is not active.' },
        message: 'Action failed',
        success: false,
      })
    }

    // Check password
    const isMatch = await bcrypt.compare(data.password, user.password)
    if (!isMatch) {
      logger.error(`login: Account ${data.email} password is incorrect.`)
      return res.status(400).json({
        error: { login: 'Your password is incorrect.' },
        message: 'Action failed',
        success: false,
      })
    }
    // Create JWT Payload
    const payload = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      active: user.active,
      code: user.code,
      notification: user.notification,
    }
    // Sign token
    const token = await signToken(payload)
    return res.json({
      token: `Bearer ${token}`,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Login failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// User is authenticated by an external mechanism.
// Just save user to DB if not exists and return a Bearer token.
const oauthLogin = async (req, res) => {
  try {
    const data = req.body
    logger.debug(`/api/user/oauthLogin: ${JSON.stringify(data.email)}`)
    // Find user by email
    let user = await User.findOneAndUpdate(
      { email: { $eq: data.email } },
      { $set: { lastLogin: new Date() } },
      { new: true },
    )
    // Is active user?
    if (user && !user.active) {
      logger.error(`oauthLogin: Account ${data.email} is not active.`)
      return res.status(400).json({
        error: { oauthLogin: 'Your account is not active.' },
        message: 'Action failed',
        success: false,
      })
    }
    // If user not exists, encode password and add new user to DB
    if (!user) {
      logger.info(
        `Create account from oauth login: ${data.email} authenticated by ${data.oauth}`,
      )

      // encode password and add new user to DB
      const hashedPassword = await encodePassword(
        data.password ? data.password : randomize('Aa0!', 12),
      )
      const code = randomize('0', 6)
      const newUser = new User({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        oauth: data.oauth,
        password: hashedPassword,
        code,
        active: true,
      })

      await newUser.save()
    }

    // requery user in case it got updated
    user = await User.findOne({ email: { $eq: data.email } })
    // Create JWT Payload
    const payload = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      oauth: user.oauth,
      active: user.active,
      code: user.code,
      notification: user.notification,
    }

    // Sign token
    const token = await signToken(payload)
    return res.json({
      token: `Bearer ${token}`,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`oauthLogin failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

// Get system announcement from .env and return to client
const getAnnouncement = async (req, res) => {
  try {
    const announcement = config.APP.ANNOUNCEMENT
    return res.json({
      announcement,
      message: 'Action successful',
      success: true,
    })
  } catch (err) {
    logger.error(`Get system announcement failed: ${err}`)
    return res.status(500).json({
      message: sysError,
      success: false,
    })
  }
}

module.exports = {
  register,
  activate,
  resetPassword,
  getActivationLink,
  getResetPasswordLink,
  login,
  oauthLogin,
  getAnnouncement,
}
