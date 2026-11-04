const router = require('express').Router()
const {
  validationRules: updateValidationRules,
  validate: updateValidate,
} = require('../validations/upload-update-validator')
const { getAll } = require('../controllers/admin-upload-controller')
const { updateOne } = require('../controllers/common-upload-controller')

/**
 * @swagger
 * /api/admin/uploads:
 *   get:
 *     summary: List uploads
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
router.get('/uploads', async (req, res) => {
  await getAll(req, res)
})

/**
 * @swagger
 * /api/admin/uploads/{code}:
 *   put:
 *     summary: Update upload
 *     tags: [Admin]
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
    await updateOne(req, res, 'admin')
  },
)

module.exports = router
