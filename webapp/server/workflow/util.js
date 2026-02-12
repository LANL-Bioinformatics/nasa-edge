const fs = require('fs')
const path = require('path')
const xlsx = require('node-xlsx').default
const Papa = require('papaparse')
const Upload = require('../edge-api/models/upload')
const config = require('../config')
const workflowConfig = require('./config')
const { write2log } = require('../utils/common')

const cromwellWorkflows = []
const nextflowWorkflows = ['sra2fastq', 'AmpIllumina']
const nextflowConfigs = {
  profiles: `${config.NEXTFLOW.WORKFLOW_DIR}/common/profiles.nf`,
  nf_reports: `${config.NEXTFLOW.WORKFLOW_DIR}/common/nf_reports.tmpl`,
}

const workflowList = {
  sra2fastq: {
    outdir: 'output/sra2fastq',
    nextflow_main: process.env.NEXTFLOW_MAIN
      ? `${process.env.NEXTFLOW_MAIN} -profile local`
      : `${config.NEXTFLOW.WORKFLOW_DIR}/sra2fastq/nextflow/main.nf -profile local`,
    config_tmpl: `${config.NEXTFLOW.WORKFLOW_DIR}/sra2fastq/workflow_config.tmpl`,
  },
  AmpIllumina: {
    outdir: 'output/AmpIllumina',
    nextflow_main: process.env.NEXTFLOW_MAIN
      ? `${process.env.NEXTFLOW_MAIN} -profile slurm,singularity`
      : `${config.NEXTFLOW.WORKFLOW_DIR}/nasa/nextflow/main.nf -profile slurm,singularity`,
    config_tmpl: `${config.NEXTFLOW.WORKFLOW_DIR}/nasa/templates/amplicon.tmpl`,
  },
}

const validUrl = url => {
  const regexp =
    /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)\/[a-zA-Z0-9()]{1}/i

  return regexp.test(url)
}

const getFilePath = async (dataPath, name, owner) => {
  // if name is a valid url, return it directly
  if (validUrl(name)) {
    return name
  }
  if (dataPath.includes(config.IO.UPLOADED_FILES_DIR)) {
    try {
      // find the real path in uploaded files dir
      // if multiple uploads with the same name, use the most recent one
      const uploads = await Upload.find({
        status: { $ne: 'delete' },
        name,
        owner,
      }).sort({ updated: 1 })
      if (uploads.length === 0) {
        return null
      }
      if (!fs.existsSync(`${dataPath}/${uploads[0].code}`)) {
        return null
      }
      return `${dataPath}/${uploads[0].code}`
    } catch (err) {
      return null
    }
  }
  if (!fs.existsSync(`${dataPath}/${name}`)) {
    return null
  }
  return `${dataPath}/${name}`
}

// eslint-disable-next-line no-unused-vars
const generateNextflowWorkflowParams = async (projHome, projectConf, proj) => {
  const params = {}
  let errMsg = ''
  if (projectConf.workflow.name === 'sra2fastq') {
    // download sra data to shared directory
    params.sraOutdir = config.IO.SRA_BASE_DIR
  } else if (projectConf.workflow.name === 'AmpIllumina') {
    // do some initialization for AmpIllumina workflow
    // add path to runsheet
    if (projectConf.workflow.input.input_file) {
      const dataPath = path.dirname(projectConf.workflow.input.input_file)
      const csv = fs.readFileSync(projectConf.workflow.input.input_file, 'utf8')
      // check if all files exist, and convert to real path for nextflow
      const newCsv = csv
        .split(/\r?\n/g)
        .map((row, index) => {
          if (index === 0) {
            // header row
            return row.split(',')
          }
          if (!row.trim()) {
            // skip empty rows
            return null
          }

          const cols = row.split(',')
          if (cols.length !== 4 && cols.length !== 5) {
            errMsg += `ERROR: Invalid number of columns in row ${index + 1} of the input csv file. Expected 4 or 5 columns, but got ${cols.length}.\n`
          }

          const filePath1 = getFilePath(dataPath, cols[1], proj.owner)
          if (!filePath1) {
            errMsg += `ERROR: File not found for ${cols[0]} in row ${index + 1}: ${cols[1]}\n`
          }
          if (cols.length === 5) {
            const filePath2 = getFilePath(dataPath, cols[2], proj.owner)
            if (!filePath2) {
              errMsg += `ERROR: File not found for ${cols[0]} in row ${index + 1}: ${cols[2]}\n`
            }
            if (errMsg) {
              return null
            }
            return [cols[0], filePath1, filePath2, cols[3], cols[4]]
          }
          if (errMsg) {
            return null
          }
          return [cols[0], filePath1, cols[2], cols[3]]
        })
        .filter(item => item !== null)

      if (!errMsg && newCsv.length === 1) {
        errMsg += 'ERROR: No valid rows found in the input csv file.\n'
      }
      if (errMsg) {
        write2log(`${config.IO.PROJECT_BASE_DIR}/${proj.code}/log.txt`, errMsg)
        throw new Error(errMsg)
      }
      // create csv file in project home
      await fs.promises.writeFile(
        `${projHome}/runsheet.csv`,
        newCsv
          .map(row => {
            row = row.join(',')
            return row
          })
          .join('\n'),
      )
      params.input_file = `${projHome}/runsheet.csv`
    }
  }

  return params
}

const generateWorkflowResult = proj => {
  const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
  const resultJson = `${projHome}/result.json`

  if (!fs.existsSync(resultJson)) {
    const result = {}
    const projectConf = JSON.parse(fs.readFileSync(`${projHome}/conf.json`))
    const outdir = `${projHome}/${workflowList[projectConf.workflow.name].outdir}`

    if (projectConf.workflow.name === 'sra2fastq') {
      // use relative path
      const { accessions } = projectConf.workflow.input
      accessions.forEach(accession => {
        // link sra downloads to project output
        fs.symlinkSync(`../../../../sra/${accession}`, `${outdir}/${accession}`)
      })
    } else if (projectConf.workflow.name === 'AmpIllumina') {
      result['Read Count Tracking'] = Papa.parse(
        fs
          .readFileSync(
            `${outdir}/workflow_output/Final_Outputs/read-count-tracking_GLAmpSeq.tsv`,
          )
          .toString(),
        { delimiter: '\t', header: true, skipEmptyLines: true },
      ).data
      result['Taxonomy and Counts'] = Papa.parse(
        fs
          .readFileSync(
            `${outdir}/workflow_output/Final_Outputs/taxonomy-and-counts_GLAmpSeq.tsv`,
          )
          .toString(),
        { delimiter: '\t', header: true, skipEmptyLines: true },
      ).data
      // get tabs' content
      result.alpha_diversity = {
        plots: [
          `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/alpha_diversity/rarefaction_curves_GLAmpSeq.png`,
          `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/alpha_diversity/richness_and_diversity_estimates_by_group_GLAmpSeq.png`,
          `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/alpha_diversity/richness_and_diversity_estimates_by_sample_GLAmpSeq.png`,
        ],
        statistics: Papa.parse(
          fs
            .readFileSync(
              `${outdir}/workflow_output/Final_Outputs/alpha_diversity/statistics_table_GLAmpSeq.csv`,
            )
            .toString(),
          { delimiter: ',', header: true, skipEmptyLines: true },
        ).data,
        summary: Papa.parse(
          fs
            .readFileSync(
              `${outdir}/workflow_output/Final_Outputs/alpha_diversity/summary_table_GLAmpSeq.csv`,
            )
            .toString(),
          { delimiter: ',', header: true, skipEmptyLines: true },
        ).data,
      }
      result.beta_diversity = {
        'Bray-Curtis dissimilarity': {
          plots: [
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/beta_diversity/bray_PCoA_w_labels_GLAmpSeq.png`,
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/beta_diversity/bray_PCoA_without_labels_GLAmpSeq.png`,
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/beta_diversity/bray_dendrogram_GLAmpSeq.png`,
          ],
          'adonis statistics': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/beta_diversity/bray_adonis_table_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
          'variance statistics': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/beta_diversity/bray_variance_table_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
        },
        'Euclidean distance': {
          plots: [
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/beta_diversity/euclidean_PCoA_w_labels_GLAmpSeq.png`,
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/beta_diversity/euclidean_PCoA_without_labels_GLAmpSeq.png`,
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/beta_diversity/euclidean_dendrogram_GLAmpSeq.png`,
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/beta_diversity/vsd_validation_plot_GLAmpSeq.png`,
          ],
          'adonis statistics': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/beta_diversity/euclidean_adonis_table_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
          'variance statistics': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/beta_diversity/euclidean_variance_table_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
        },
      }
      result.taxonomy = {
        'by Phylum': {
          plots: [
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/groups_phylum_GLAmpSeq.png`,
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/samples_phylum_GLAmpSeq.png`,
          ],
        },
        'by Class': {
          plots: [
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/groups_class_GLAmpSeq.png`,
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/samples_class_GLAmpSeq.png`,
          ],
        },
        'by Order': {
          plots: [
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/groups_order_GLAmpSeq.png`,
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/samples_order_GLAmpSeq.png`,
          ],
        },
        'by Family': {
          plots: [
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/groups_family_GLAmpSeq.png`,
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/samples_family_GLAmpSeq.png`,
          ],
        },
        'by Genus': {
          plots: [
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/groups_genus_GLAmpSeq.png`,
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/samples_genus_GLAmpSeq.png`,
          ],
        },
        'by Species': {
          plots: [
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/groups_species_GLAmpSeq.png`,
            `${workflowList[projectConf.workflow.name].outdir}/workflow_output/Final_Outputs/taxonomy_plots/samples_species_GLAmpSeq.png`,
          ],
        },
      }

      result.differential_abundance = {
        ANCOMBC1: {
          plots: ['need find all ANCOMBC1 plots'],
          'Sample Info': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/differential_abundance/SampleTable_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
          'Pairwise Contrasts': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/differential_abundance/contrasts_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
          'Differential Abundance': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/differential_abundance/ancombc1/ancombc1_differential_abundance_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
        },
        ANCOMBC2: {
          plots: ['need find all ANCOMBC2 plots'],
          'Sample Info': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/differential_abundance/SampleTable_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
          'Pairwise Contrasts': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/differential_abundance/contrasts_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
          'Differential Abundance': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/differential_abundance/ancombc2/ancombc2_differential_abundance_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
        },
        DESeq2: {
          plots: ['need find all DESeq2 plots'],
          'Sample Info': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/differential_abundance/SampleTable_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
          'Pairwise Contrasts': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/differential_abundance/contrasts_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
          'Differential Abundance': Papa.parse(
            fs
              .readFileSync(
                `${outdir}/workflow_output/Final_Outputs/differential_abundance/deseq2/deseq2_differential_abundance_GLAmpSeq.csv`,
              )
              .toString(),
            { delimiter: ',', header: true, skipEmptyLines: true },
          ).data,
        },
      }
      result.differential_abundance.ANCOMBC1.plots = []
      result.differential_abundance.ANCOMBC2.plots = []
      result.differential_abundance.DESeq2.plots = []
      const plotReg = /_(.*).png$/
      let plotDir =
        'workflow_output/Final_Outputs/differential_abundance/ancombc1'
      let plots = fs.readdirSync(`${outdir}/${plotDir}`)
      plots.forEach(plot => {
        if (plotReg.test(plot)) {
          result.differential_abundance.ANCOMBC1.plots.push(
            `${workflowList[projectConf.workflow.name].outdir}/${plotDir}/${plot}`,
          )
        }
      })
      plotDir = 'workflow_output/Final_Outputs/differential_abundance/ancombc2'
      plots = fs.readdirSync(`${outdir}/${plotDir}`)
      plots.forEach(plot => {
        if (plotReg.test(plot)) {
          result.differential_abundance.ANCOMBC2.plots.push(
            `${workflowList[projectConf.workflow.name].outdir}/${plotDir}/${plot}`,
          )
        }
      })
      plotDir = 'workflow_output/Final_Outputs/differential_abundance/deseq2'
      plots = fs.readdirSync(`${outdir}/${plotDir}`)
      plots.forEach(plot => {
        if (plotReg.test(plot)) {
          result.differential_abundance.DESeq2.plots.push(
            `${workflowList[projectConf.workflow.name].outdir}/${plotDir}/${plot}`,
          )
        }
      })
    }
    fs.writeFileSync(resultJson, JSON.stringify(result))
  }
}

const checkFlagFile = (proj, jobQueue) => {
  const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
  const outDir = `${projHome}/${workflowList[proj.type].outdir}`
  if (jobQueue === 'local') {
    const flagFile = `${projHome}/.done`
    if (!fs.existsSync(flagFile)) {
      return false
    }
  }
  // check expected output files
  if (proj.type === 'assayDesign') {
    const outJson = `${outDir}/jbrowse/jbrowse_url.json`
    if (!fs.existsSync(outJson)) {
      return false
    }
  }
  return true
}

const getWorkflowCommand = proj => {
  const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
  const projectConf = JSON.parse(fs.readFileSync(`${projHome}/conf.json`))
  const outDir = `${projHome}/${workflowList[projectConf.workflow.name].outdir}`
  let command = ''
  if (proj.type === 'assayDesign') {
    // create bioaiConf.json
    const conf = `${projHome}/bioaiConf.json`
    fs.writeFileSync(
      conf,
      JSON.stringify({
        pipeline: 'bioai',
        params: { ...projectConf.workflow.input, ...projectConf.genomes },
      }),
    )
    command += ` && ${workflowConfig.WORKFLOW.BIOAI_EXEC} -i ${conf} -o ${outDir}`
  }
  return command
}

const validateBulkSubmissionInput = async (bulkExcel, type) => {
  // Parse a file
  const workSheetsFromFile = xlsx.parse(bulkExcel)
  const rows = workSheetsFromFile[0].data.filter(row =>
    // Check if all cells in the row are empty (null, undefined, or empty string after trim)
    row.some(
      cell => cell !== null && cell !== undefined && String(cell).trim() !== '',
    ),
  )
  // Remove header
  rows.shift()
  // validate inputs
  let validInput = true
  let errMsg = ''
  const submissions = []
  if (rows.length === 0) {
    validInput = false
    errMsg += 'ERROR: No submission found in the bulk excel file.\n'
  }

  if (type === 'wastewater') {
    // do some validation for wastewater submission\
  }
  // eslint-disable-next-line consistent-return
  return { validInput, errMsg, submissions }
}

module.exports = {
  cromwellWorkflows,
  nextflowWorkflows,
  nextflowConfigs,
  workflowList,
  generateNextflowWorkflowParams,
  generateWorkflowResult,
  checkFlagFile,
  getWorkflowCommand,
  validateBulkSubmissionInput,
}
