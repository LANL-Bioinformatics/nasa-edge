const router = require('express').Router()
const {
  validationRules: projectCodeValidationRules,
  validate: projectCodeValidate,
} = require('../validations/project-code-validator')
const {
  getAll,
  getOne,
  getConf,
  getOutputs,
  getResult,
  getRunStats,
} = require('../controllers/project-controller')
const {
  getOutputTreeData,
  downloadOutputs,
} = require('../controllers/common-project-controller')

/**
 * @swagger
 * /api/public/projects:
 *   get:
 *     summary: All public projects
 *     tags: [Project]
 *     responses:
 *       200:
 *         description: Action successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/models/projectsActionSuccessful'
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
router.get('/', async (req, res) => {
  await getAll(req, res)
})

/**
 * @swagger
 * /api/public/projects/{code}:
 *   get:
 *     summary: Get a project by code
 *     tags: [Project]
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
  '/:code',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getOne(req, res)
  },
)

/**
 * @swagger
 * /api/public/projects/{code}/conf:
 *   get:
 *     summary: Get a project configuration by code
 *     tags: [Project]
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
  '/:code/conf',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getConf(req, res)
  },
)

/**
 * @swagger
 * /api/public/projects/{code}/outputs:
 *   get:
 *     summary: Get output files by code
 *     tags: [Project]
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
  '/:code/outputs',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getOutputs(req, res)
  },
)

router.get(
  '/:code/outputTreeData',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getOutputTreeData(req, res, 'public')
  },
)

/**
 * @swagger
 * /api/public/projects/{code}/result:
 *   get:
 *     summary: Get a project result by code
 *     tags: [Project]
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
  '/:code/result',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getResult(req, res)
  },
)

/**
 * @swagger
 * /api/public/projects/{code}/runStats:
 *   get:
 *     summary: Get a project run stats by code
 *     tags: [Project]
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
  '/:code/runStats',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await getRunStats(req, res)
  },
)

router.post(
  '/:code/downloadOutputs',
  projectCodeValidationRules(),
  projectCodeValidate,
  async (req, res) => {
    await downloadOutputs(req, res, 'public')
  },
)
module.exports = router
