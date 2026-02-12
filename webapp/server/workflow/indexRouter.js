const router = require('express').Router()
const dataRoutes = require('./workflow-api/routes/data')

router.use('/data', dataRoutes)
// Add more workflow-specific routes here

module.exports = router
