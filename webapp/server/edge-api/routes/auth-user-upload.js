const router = require('express').Router()
const {
  validationRules: addValidationRules,
  validate: addValidate,
} = require('../validations/upload-validator')
const {
  validationRules: updateValidationRules,
  validate: updateValidate,
} = require('../validations/upload-update-validator')
const {
  addOne,
  getOwn,
  getInfo,
  getAll,
} = require('../controllers/auth-user-upload-controller')
const { updateOne } = require('../controllers/common-upload-controller')

/**
 * @swagger
 * /api/auth-user/uploads:
 *   get:
 *     summary: List uploads owned by user
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
router.get('/uploads', async (req, res) => {
  await getOwn(req, res)
})

/**
 * @swagger
 * /api/auth-user/uploads/files:
 *   post:
 *     summary: List uploads that user can access to
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
router.post('/uploads/files', async (req, res) => {
  await getAll(req, res)
})

/**
 * @swagger
 * /api/auth-user/uploads/info:
 *   get:
 *     summary: Find upload storage info
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
router.get('/uploads/info', async (req, res) => {
  await getInfo(req, res)
})

/**
 * @swagger
 * /api/auth-user/uploads:
 *   post:
 *     summary: Create new upload
 *     tags: [AuthUser]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               upload:
 *                 type: string
 *                 format: binary
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/addUpload'
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
router.post('/uploads', addValidationRules(), addValidate, async (req, res) => {
  await addOne(req, res)
})

/**
 * @swagger
 * /api/auth-user/uploads/{code}:
 *   put:
 *     summary: Update upload
 *     tags: [AuthUser]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *      - in: path
 *        name: code
 *        required: true
 *        type: string
 *        value: test
 *        description: The upload unique code.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/models/updateUpload'
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
  '/uploads/:code',
  updateValidationRules(),
  updateValidate,
  async (req, res) => {
    await updateOne(req, res, 'user')
  },
)

module.exports = router
