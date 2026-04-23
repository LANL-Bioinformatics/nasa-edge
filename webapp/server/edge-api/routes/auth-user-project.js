const router = require('express').Router()
const {
  validationRules: projectCodeValidationRules,
  validate: projectCodeValidate,
} = require('../validations/project-code-validator')
const {
  validationRules: addValidationRules,
  validate: addValidate,
} = require('../validations/project-validator')
const {
  validationRules: updateValidationRules,
  validate: updateValidate,
} = require('../validations/project-update-validator')
const {
  addOne,
  getOne,
  updateOne,
  getConf,
  getOwn,
  getAll,
  getQueue,
  getFiles,
  getOutputs,
  getBatchOutputs,
  getResult,
  getRunStats,
  getProjectsByType,
} = require('../controllers/auth-user-project-controller')
const {
  getOutputTreeData,
  downloadOutputs,
} = require('../controllers/common-project-controller')

/**
 * @swagger
 * /api/auth-user/projects:
 *   get:
 *     summary: List projects owned by user
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
router.get('/projects', async (req, res) => {
  await getOwn(req, res)
})

/**
 * @swagger
 * /api/auth-user/projects/all:
 *   get:
 *     summary: List projects that user can access to
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
router.get('/projects/all', async (req, res) => {
  await getAll(req, res)
})

/**
 * @swagger
 * /api/auth-user/projects/queue:
 *   get:
 *     summary: List projects that are still running or in queue
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
router.get('/projects/queue', async (req, res) => {
  await getQueue(req, res)
})

/**
 * @swagger
 * /api/auth-user/projects/files:
 *   post:
 *     summary: Find all files matching fileTypes in project directories
 *     tags: [AuthUser]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/projectFiles'
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
router.post('/projects/files', async (req, res) => {
  await getFiles(req, res)
})

/**
 * @swagger
 * /api/auth-user/projects:
 *   post:
 *     summary: Create new project
 *     tags: [AuthUser]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/addProject'
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
  '/projects',
  addValidationRules(),
  addValidate,
  async (req, res) => {
    await addOne(req, res)
  },
)

/**
 * @swagger
 * /api/auth-user/projects/{code}:
 *   put:
 *     summary: Update project
 *     tags: [AuthUser]
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
 * /api/auth-user/projects/{code}:
 *   get:
 *     summary: Get a project by code
 *     tags: [AuthUser]
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
 * /api/auth-user/projects/type/{type}:
 *   get:
 *     summary: Get projects by type
 *     tags: [AuthUser]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: type
 *        required: true
 *        type: string
 *        value: test
 *        description: The project type.
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
router.get('/projects/type/:type', async (req, res) => {
  await getProjectsByType(req, res)
})

/**
 * @swagger
 * /api/auth-user/projects/{code}/conf:
 *   get:
 *     summary: Get a project configuration by code
 *     tags: [AuthUser]
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
 * /api/auth-user/projects/{code}/outputs:
 *   get:
 *     summary: Get output files by code
 *     tags: [AuthUser]
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
    await getOutputTreeData(req, res, 'user')
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
 * /api/auth-user/projects/{code}/batch/outputs:
 *   get:
 *     summary: Get output files by code
 *     tags: [AuthUser]
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
 * /api/auth-user/projects/{code}/result:
 *   get:
 *     summary: Get project result by code
 *     tags: [AuthUser]
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
 * /api/auth-user/projects/{code}/runStats:
 *   get:
 *     summary: Get project runStats by code
 *     tags: [AuthUser]
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
