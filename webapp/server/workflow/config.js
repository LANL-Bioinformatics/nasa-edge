/**
 * Configure the workflow based upon environment variables.
 */

const path = require('path')

// Determine several reusable directory paths based upon environment variables
// and/or the path to the directory containing this `config.js` file.
const appServerDir = process.env.APP_SERVER_DIR
  ? process.env.APP_SERVER_DIR
  : __dirname
const WORKFLOW_DATA_BASE_DIR = path.join(
  appServerDir,
  '../../../workflows/data',
)

const workflowConfig = {
  DATA_DIR: WORKFLOW_DATA_BASE_DIR,
  data: {
    REF_LIST:
      process.env.WORKFLOW_REF_LIST ||
      path.join(WORKFLOW_DATA_BASE_DIR, 'Ref_list.json'),
  },
  assayDesign: {
    SPECIES_JSON:
      process.env.SPECIES_JSON ||
      path.join(WORKFLOW_DATA_BASE_DIR, 'species.json'),
    SPECIES_TREE_JSON:
      process.env.SPECIES_TREE_JSON ||
      path.join(WORKFLOW_DATA_BASE_DIR, 'speciesTree4UI.json'),
    BIOAI_EXEC: process.env.BIOAI_EXEC || '/opt/bioai/pipeline/bioai_runner.py',
  },
  // Add more workflow-specific configuration settings here
}

module.exports = workflowConfig
