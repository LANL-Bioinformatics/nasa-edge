const router = require('express').Router()
const {
  validationRules: projectCodeValidationRules,
  validate: projectCodeValidate,
} = require('../validations/project-code-validator')
const {
  validationRules: updateValidationRules,
  validate: updateValidate,
} = require('../validations/project-update-validator')
const {
  getOne,
  updateOne,
  getConf,
  getAll,
  getOutputs,
  getBatchOutputs,
  getResult,
  getRunStats,
} = require('../controllers/admin-project-controller')
const {
  getOutputTreeData,
  downloadOutputs,
} = require('../controllers/common-project-controller')

/**
 * @swagger
 * /api/admin/projects:
 *   get:
 *     summary: List projects
 *     tags: [Admin]
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
router.get('/projects', async (req, res) => {
  await getAll(req, res)
})

/**
 * @swagger
 * /api/admin/projects/{code}:
 *   put:
 *     summary: Update project
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The project unique code.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/updateProject'
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
  '/projects/:code',
  updateValidationRules(),
  updateValidate,
  async (req, res) => {
    await updateOne(req, res)
  },
)

/**
 * @swagger
 * /api/admin/projects/{code}:
 *   get:
 *     summary: Get a project by code
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The project unique code.
 *     responses:
 *       200:
 *         description: Action successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/projectActionSuccessful'
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
  '/projects/:code',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getOne(req, res)
  },
)

/**
 * @swagger
 * /api/admin/projects/{code}/conf:
 *   get:
 *     summary: Get a project configuration by code
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The project unique code.
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
  '/projects/:code/conf',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getConf(req, res)
  },
)

/**
 * @swagger
 * /api/admin/projects/{code}/outputs:
 *   get:
 *     summary: Get output files by code
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The project unique code.
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
  '/projects/:code/outputs',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getOutputs(req, res)
  },
)

router.get(
  '/projects/:code/outputTreeData',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getOutputTreeData(req, res, 'admin')
  },
)

router.post(
  '/projects/:code/downloadOutputs',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await downloadOutputs(req, res, 'user')
  },
)

/**
 * @swagger
 * /api/admin/projects/{code}/batch/outputs:
 *   get:
 *     summary: Get output files by code
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The project unique code.
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
  '/projects/:code/batch/outputs',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getBatchOutputs(req, res)
  },
)

/**
 * @swagger
 * /api/admin/projects/{code}/result:
 *   get:
 *     summary: Get a project result by code
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The project unique code.
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
  '/projects/:code/result',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getResult(req, res)
  },
)

/**
 * @swagger
 * /api/admin/projects/{code}/runStats:
 *   get:
 *     summary: Get a project runStats by code
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The project unique code.
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
  '/projects/:code/runStats',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getRunStats(req, res)
  },
)

module.exports = router
