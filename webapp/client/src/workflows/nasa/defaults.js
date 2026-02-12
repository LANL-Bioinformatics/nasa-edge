import { workflowList } from 'src/util'

export const workflowOptions = [{ value: 'AmpIllumina', label: workflowList['AmpIllumina'].label }]

export const workflows = {
  AmpIllumina: {
    validForm: false,
    errMessage: 'input error',
    files: [],
    inputs: {
      start_input: {
        text: 'Input Type',
        value: 'accession',
        display: 'Accession',
        options: [
          {
            text: 'Accession',
            value: 'accession',
            detail: `<b>Start with OSD or GLDS accession as input</b><br/>
          <span style="font-size: 0.9rem; color: grey;">The OSD or GLDS accession number specifying the <a href='https://osdr.nasa.gov/bio/repo/search?q=&data_source=cgene,alsda&data_type=study' target='_blank' rel="noreferrer" >OSDR</a> dataset to process, e.g. OSD-487 or GLDS-487
          Note: Not all datasets have the same OSD and GLDS number, so make sure the correct OSD or GLDS number is specified.</span>`,
          },
          {
            text: 'Runsheet CSV file',
            value: 'input_file',
            detail: `<b>Start with a runsheet csv file as input</b><br/>
            <span style="font-size: 0.9rem; color: grey;"> A single-end or paired-end runsheet csv file containing assay metadata for each sample,
            including sample_id, forward (path to forward read), [reverse (path to reverse read, for paired-end only),] paired (boolean, TRUE | FALSE),
            groups (specifies sample treatment group name). Please see the <a href='https://github.com/nasa/GeneLab_AmpliconSeq_Workflow/tree/main/examples/runsheet' target='_blank' rel="noreferrer" >runsheet </a> in this repository for examples on how to format this file.
            Note: If using an uploaded file, just add the file name without the local path.</span>`,
          },
        ],
      },
      accession: {
        text: 'Accession',
        value: '',
        textInput: {
          placeholder: '(Required) OSD or GLDS accession number',
          showError: true,
          isOptional: false,
          showErrorTooltip: true,
          defaultValue: '',
          toUpperCase: true,
        },
      },
      input_file: {
        text: 'Runsheet CSV',
        value: null,
        display: null,
        fileInput: {
          enableInput: true,
          placeholder: '(Required) Select a file or enter a file http(s) url',
          dataSources: ['upload', 'public'],
          fileTypes: ['csv'],
          viewFile: false,
          isOptional: false,
          cleanupInput: false,
        },
      },
      group: {
        text: 'Group Column',
        tooltip:
          'Column name in input CSV file containing groups to be compared (type: string, default: "groups")',
        value: 'groups',
        textInput: {
          placeholder: '(Required) default: "groups"',
          showError: true,
          isOptional: false,
          showErrorTooltip: true,
          defaultValue: 'groups',
        },
      },
      samples_column: {
        text: 'Sample Column',
        tooltip:
          'Column name in input CSV file containing sample names (type: string, default: "sample_id")',
        value: 'sample_id',
        textInput: {
          placeholder: '(Required) default: "sample_id"',
          showError: true,
          isOptional: false,
          showErrorTooltip: true,
          defaultValue: 'sample_id',
        },
      },
      target_region: {
        text: 'Target Region',
        tooltip:
          ' Specifies the amplicon target region to be analyzed. This determines which reference database is used for taxonomic classification, and it is used to select the appropriate dataset from an OSD study when multiple options are available.',
        value: '16S',
        display: '16S',
        options: [
          { text: '16S', value: '16S' },
          { text: '18S', value: '18S' },
          { text: 'ITS', value: 'ITS' },
        ],
      },
      trim_primers: {
        text: 'Trim Primers',
        tooltip: 'Whether primers should be trimmed (type: string, default: "TRUE")',
        value: 'TRUE',
        display: 'TRUE',
        options: [
          { text: 'TRUE', value: 'TRUE' },
          { text: 'FALSE', value: 'FALSE' },
        ],
      },
      primers_linked: {
        text: 'Primers Linked',
        tooltip: 'Whether forward and reverse primers are linked (type: string, default: "TRUE")',
        value: 'TRUE',
        display: 'TRUE',
        options: [
          { text: 'TRUE', value: 'TRUE' },
          { text: 'FALSE', value: 'FALSE' },
        ],
      },
      anchored_primers: {
        text: 'Anchor Primers',
        tooltip:
          'Whether primers are anchored at the start of reads (type: string, default: "TRUE")',
        value: 'TRUE',
        display: 'TRUE',
        options: [
          { text: 'TRUE', value: 'TRUE' },
          { text: 'FALSE', value: 'FALSE' },
        ],
      },
      min_cutadapt_len: {
        text: 'Minimum Cutadapt Length',
        tooltip:
          'Minimum length of reads to keep after Cutadapt trimming (type: integer, default: 130)',
        value: 130,
        rangeInput: {
          defaultValue: 130,
          min: 0,
          max: 500,
          step: 1,
        },
      },
      discard_untrimmed: {
        text: 'Discard Untrimmed',
        tooltip: 'Whether to discard untrimmed reads (type: string, default: "TRUE")',
        value: 'TRUE',
        display: 'TRUE',
        options: [
          { text: 'TRUE', value: 'TRUE' },
          { text: 'FALSE', value: 'FALSE' },
        ],
      },
      F_primer: {
        text: 'Forward primer',
        tooltip: 'Forward primer sequence (type: string)',
        value: '',
        textInput: {
          placeholder: '(Required) Must be 1-200 bases long, IUPAC nucleotide codes only',
          showError: true,
          isOptional: false,
          showErrorTooltip: true,
          defaultValue: '',
        },
      },
      R_primer: {
        text: 'Reverse primer',
        tooltip: 'Reverse primer sequence (type: string)',
        value: '',
        textInput: {
          placeholder: '(Required) Must be 1-200 bases long, IUPAC nucleotide codes only',
          showError: true,
          isOptional: false,
          showErrorTooltip: true,
          defaultValue: '',
        },
      },
      left_trunc: {
        text: 'Left Trunc',
        tooltip:
          'Truncate forward reads after this many bases. Reads shorter than this are discarded (type: integer, default: 0)',
        value: 0,
        rangeInput: {
          defaultValue: 0,
          min: 0,
          max: 300,
          step: 1,
        },
      },
      right_trunc: {
        text: 'Right Trunc',
        tooltip:
          'Truncate reverse reads after this many bases. Reads shorter than this are discarded (type: integer, default: 0)',
        value: 0,
        rangeInput: {
          defaultValue: 0,
          min: 0,
          max: 300,
          step: 1,
        },
      },
      left_maxEE: {
        text: 'Left maxEE',
        tooltip: 'Maximum expected errors allowed in forward reads (type: integer, default: 1)',
        value: 1,
        rangeInput: {
          defaultValue: 1,
          min: 0,
          max: 5,
          step: 1,
        },
      },
      right_maxEE: {
        text: 'Right maxEE',
        tooltip: 'Maximum expected errors allowed in reverse reads (type: integer, default: 1)',
        value: 1,
        rangeInput: {
          defaultValue: 1,
          min: 0,
          max: 5,
          step: 1,
        },
      },
      concatenate_reads_only: {
        text: 'Concatenate Reads Only',
        tooltip:
          'Whether to concatenate paired reads end-to-end instead of merging based on overlapping regions (type: string, default: "FALSE")',
        value: 'FALSE',
        display: 'FALSE',
        options: [
          { text: 'TRUE', value: 'TRUE' },
          { text: 'FALSE', value: 'FALSE' },
        ],
      },
      rarefaction_depth: {
        text: 'Rarefaction Depth',
        tooltip:
          'The minimum desired sample rarefaction depth for beta diversity analysis (type: integer, default: 500, range: 0 - 10000)',
        value: 500,
        integerInput: {
          defaultValue: 500,
          min: 0,
          max: 10000,
        },
      },
      diff_abund_method: {
        text: 'Differential abundance Method',
        tooltip: 'Differential abundance testing method to use (type: string, default: "all")',
        value: 'all',
        display: 'all',
        options: [
          { text: 'all', value: 'all' },
          { text: 'ancombc1', value: 'ancombc1' },
          { text: 'ancombc2', value: 'ancombc2' },
          { text: 'deseq2', value: 'deseq2' },
        ],
      },
      remove_struc_zeros: {
        text: 'Remove Structural Zeros',
        tooltip:
          'Whether to remove structural zeros when running ANCOMBC (type: boolean, default: false)',
        value: false,
        switcher: {
          trueText: 'true',
          falseText: 'false',
          defaultValue: false,
        },
      },
      remove_rare: {
        text: 'Remove Rare',
        tooltip:
          ' Whether to filter out rare features and samples with low library sizes. Set this to true if using prevalence_cutoff or library_cutoff (type: boolean, default: false)',
        value: false,
        switcher: {
          trueText: 'true',
          falseText: 'false',
          defaultValue: false,
        },
      },
      prevalence_cutoff: {
        text: 'Prevalence Cutoff',
        tooltip:
          'Taxa with prevalence below this fraction will be excluded (type: float, default: 0)',
        value: 0,
        rangeInput: {
          defaultValue: 0,
          min: 0,
          max: 1,
          step: 0.01,
        },
      },
      library_cutoff: {
        text: 'Library Cutoff',
        tooltip:
          'Samples with library sizes below this threshold will be excluded (type: integer, default: 0)',
        value: 0,
        rangeInput: {
          defaultValue: 0,
          min: 0,
          max: 300,
          step: 1,
        },
      },
    },
    // only for input with validation method
    validInputs: {
      input_file: { isValid: false, error: 'Runsheet CSV input error.' },
      accession: {
        isValid: false,
        error: 'Assession input error. Must be OSD or GLDS accession number',
      },
      rarefaction_depth: {
        isValid: true,
        error: 'Rarefaction Depth input error. Must be an integer. Range: 0 - 10000',
      },
      group: {
        isValid: true,
        error: 'Group Column input error. Must be a valid column name in the runsheet CSV',
      },
      samples_column: {
        isValid: true,
        error: 'Sample Column input error. Must be a valid column name in the runsheet CSV',
      },
      F_primer: {
        isValid: true,
        error:
          'F_primer input error. Invalid primer sequence. Must be 1-200 bases long, ACGT only.',
      },
      R_primer: {
        isValid: true,
        error:
          'R_primer input error. Invalid primer sequence. Must be 1-200 bases long, ACGT only.',
      },
    },
  },
}
