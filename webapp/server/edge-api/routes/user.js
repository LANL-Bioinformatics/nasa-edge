const router = require('express').Router()
const {
  validationRules: registerValidationRules,
  validate: registerValidate,
} = require('../validations/user-validator')
const {
  validationRules: activateValidationRules,
  validate: activateValidate,
} = require('../validations/user-activate-validator')
const {
  validationRules: getActionLinkValidationRules,
  validate: getActionLinkValidate,
} = require('../validations/get-action-link-validator')
const {
  validationRules: resetPasswordValidationRules,
  validate: resetPasswordValidate,
} = require('../validations/reset-password-validator')
const {
  validationRules: loginValidationRules,
  validate: loginValidate,
} = require('../validations/login-validator')
const {
  validationRules: oauthLoginValidationRules,
  validate: oauthLoginValidate,
} = require('../validations/oauth-login-validator')
const {
  register,
  activate,
  getActivationLink,
  resetPassword,
  getResetPasswordLink,
  login,
  oauthLogin,
  getAnnouncement,
} = require('../controllers/user-controller')

/**
 * @swagger
 * /api/user/register:
 *   post:
 *     summary: Create a new user
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/registerUser'
 *     responses:
 *       200:
 *         description: Action successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionSuccessful'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionFailed'
 *       500:
 *         description: API server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/serverError'
 */
router.post(
  '/register',
  registerValidationRules(),
  registerValidate,
  async (req, res) => {
    await register(req, res)
  },
)

/**
 * @swagger
 * /api/user/activate:
 *   put:
 *     summary: Activate user account
 *     tags: [User]
 *     operationId: activate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/activateUser'
 *     responses:
 *       200:
 *         description: Action successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionSuccessful'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionFailed'
 *       500:
 *         description: API server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/serverError'
 */
router.put(
  '/activate',
  activateValidationRules(),
  activateValidate,
  async (req, res) => {
    await activate(req, res)
  },
)

/**
 * @swagger
 * /api/user/getActivationLink:
 *   post:
 *     summary: Send out a link to activate an account
 *     tags: [User]
 *     operationId: getActivationLink
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/getActionLink'
 *     responses:
 *       200:
 *         description: Action successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionSuccessful'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionFailed'
 *       500:
 *         description: API server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/serverError'
 */
router.post(
  '/getActivationLink',
  getActionLinkValidationRules(),
  getActionLinkValidate,
  async (req, res) => {
    await getActivationLink(req, res)
  },
)

/**
 * @swagger
 * /api/user/resetPassword:
 *   put:
 *     summary: Reset user password
 *     tags: [User]
 *     operationId: resetPassword
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/resetPassword'
 *     responses:
 *       200:
 *         description: Action successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionSuccessful'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionFailed'
 *       500:
 *         description: API server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/serverError'
 */
router.put(
  '/resetPassword',
  resetPasswordValidationRules(),
  resetPasswordValidate,
  async (req, res) => {
    await resetPassword(req, res)
  },
)

/**
 * @swagger
 * /api/user/getResetPasswordLink:
 *   post:
 *     summary: Send out a link to resetPassword for an account
 *     tags: [User]
 *     operationId: getResetPasswordLink
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/getActionLink'
 *     responses:
 *       200:
 *         description: Action successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionSuccessful'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionFailed'
 *       500:
 *         description: API server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/serverError'
 */
router.post(
  '/getResetPasswordLink',
  getActionLinkValidationRules(),
  getActionLinkValidate,
  async (req, res) => {
    await getResetPasswordLink(req, res)
  },
)

/**
 * @swagger
 * /api/user/login:
 *   post:
 *     summary: Return Bearer token
 *     tags: [User]
 *     operationId: login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/login'
 *     responses:
 *       200:
 *         description: Action successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionSuccessful'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionFailed'
 *       500:
 *         description: API server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/serverError'
 */
router.post(
  '/login',
  loginValidationRules(),
  loginValidate,
  async (req, res) => {
    await login(req, res)
  },
)

/**
 * @swagger
 * /api/user/oauthLogin:
 *   post:
 *     summary: Return Bearer token
 *     tags: [User]
 *     operationId: oauthLogin
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/oauthLogin'
 *     responses:
 *       200:
 *         description: Action successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionSuccessful'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/actionFailed'
 *       500:
 *         description: API server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/serverError'
 */
router.post(
  '/oauthLogin',
  oauthLoginValidationRules(),
  oauthLoginValidate,
  async (req, res) => {
    await oauthLogin(req, res)
  },
)

// get system announcement
router.get('/announcement', async (req, res) => {
  await getAnnouncement(req, res)
})

module.exports = router
