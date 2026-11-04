const router = require('express').Router()
const {
  validationRules: bulkSubmissionCodeValidationRules,
  validate: bulkSubmissionCodeValidate,
} = require('../validations/bulkSubmission-code-validator')
const {
  validationRules: addValidationRules,
  validate: addValidate,
} = require('../validations/bulkSubmission-validator')
const {
  validationRules: updateValidationRules,
  validate: updateValidate,
} = require('../validations/bulkSubmission-update-validator')
const {
  addOne,
  getOwn,
} = require('../controllers/auth-user-bulkSubmission-controller')
const {
  getOne,
  updateOne,
  getConf,
  getProjects,
} = require('../controllers/common-bulkSubmission-controller')

/**
 * @swagger
 * /api/auth-user/bulkSubmissions:
 *   get:
 *     summary: List bulkSubmissions owned by user
 *     tags: [AuthUser]
 *     security:
 *       - bearerAuth: []
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
router.get('/bulkSubmissions', async (req, res) => {
  await getOwn(req, res)
})

/**
 * @swagger
 * /api/auth-user/bulkSubmissions:
 *   post:
 *     summary: Create new bulkSubmission
 *     tags: [AuthUser]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/addBulkSubmission'
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
  '/bulkSubmissions',
  addValidationRules(),
  addValidate,
  async (req, res) => {
    await addOne(req, res)
  },
)

/**
 * @swagger
 * /api/auth-user/bulkSubmissions/{code}:
 *   put:
 *     summary: Update bulkSubmission
 *     tags: [AuthUser]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The bulkSubmission unique code.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/updateBulkSubmission'
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
  '/bulkSubmissions/:code',
  updateValidationRules(),
  updateValidate,
  async (req, res) => {
    await updateOne(req, res, 'user')
  },
)

/**
 * @swagger
 * /api/auth-user/bulkSubmissions/{code}:
 *   get:
 *     summary: Get a bulkSubmission by code
 *     tags: [AuthUser]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The bulkSubmission unique code.
 *     responses:
 *       200:
 *         description: Action successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/bulkSubmissionActionSuccessful'
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
router.get(
  '/bulkSubmissions/:code',
  bulkSubmissionCodeValidationRules(),
  bulkSubmissionCodeValidate,
  async (req, res) => {
    await getOne(req, res, 'user')
  },
)

/**
 * @swagger
 * /api/auth-user/bulkSubmissions/{code}/conf:
 *   get:
 *     summary: Get a bulkSubmission configuration by code
 *     tags: [AuthUser]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The bulkSubmission unique code.
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
router.get(
  '/bulkSubmissions/:code/conf',
  bulkSubmissionCodeValidationRules(),
  bulkSubmissionCodeValidate,
  async (req, res) => {
    await getConf(req, res, 'user')
  },
)

/**
 * @swagger
 * /api/admin/bulkSubmissions/{code}/projects:
 *   get:
 *     summary: Get a bulkSubmission projects by code
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The bulkSubmission unique code.
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
router.get(
  '/bulkSubmissions/:code/projects',
  bulkSubmissionCodeValidationRules(),
  bulkSubmissionCodeValidate,
  async (req, res) => {
    await getProjects(req, res, 'user')
  },
)

module.exports = router
