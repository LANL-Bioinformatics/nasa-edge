export const components = {
  textInput: {
    validForm: false,
    textInput: '',
  },
  textInputArray: {
    validForm: false,
    textInputs: [],
  },
  integerInput: {
    validForm: false,
    integerInput: null,
  },
  rangeInput: {
    validForm: true,
    rangeInput: 0,
  },
  range2Input: {
    validForm: true,
    start: 0,
    end: 1,
  },
  rangeTextInput: {
    validForm: false,
    start: 0,
    end: 1,
  },
  rangeTextInputSingle: {
    validForm: false,
    start: 0,
    end: 1,
  },
  rangeTextInputArray: {
    validForm: false,
    rangeInputs: [],
  },
  switcher: {
    validForm: true,
    isTrue: true,
  },
  selectInput: {
    validForm: false,
    selection: null,
  },
  asyncSelectInput: {
    validForm: false,
    selections: [],
  },
  colorPicker: {
    validForm: true,
    color: '#000000',
  },
  multSelectInput: {
    validForm: false,
    selections: [],
  },
  treeSelectInput: {
    validForm: false,
    selections: [],
  },
  configFileInput: {
    validForm: false,
    fileInput: null,
    fileInput_display: null,
  },
  fileUpload: {
    file: '',
    validForm: false,
    errMessage: 'File is required',
  },
  folderInput: {
    validForm: false,
    folderInput: null,
    folderInput_display: null,
    files: [],
  },
  fileInput: {
    validForm: false,
    fileInput: null,
    fileInput_display: null,
    fileInput_source: null,
  },
  fileInputArray: {
    validForm: false,
    fileInput: [],
    fileInput_display: [],
    fileInput_isValid: [],
    fileInput_source: [],
  },
  pairedFileInputArray: {
    validForm: false,
    fileInput: [],
    fileInput_display: [],
    fileInput_isValid: [],
    fileInput_source: [],
  },
  optionSelector: {
    validForm: true,
    option: '',
    display: '',
  },
  radioSelector: {
    validForm: true,
    option: '',
    display: '',
  },
  fastqInput: {
    params: {
      paired: {
        trueText: 'Yes',
        falseText: 'No',
        defaultValue: true,
        text: 'Paired-End',
      },
      fastq: {
        text: 'Fastq',
      },
      pairedFastq: {
        text: 'Paired Fastq',
      },
    },
    init: {
      validForm: false,
      errMessage: '',
      paired: true,
      platform: 'illumina',
      platform_display: 'Illumina',
      fileInput: [],
      fileInput_display: [],
      fileInput_source: [],
      fastqInspection: null,
    },
  },
  project: {
    params: {
      projectName: {
        text: 'Project/Run Name',
        placeholder: 'required, at 3 but less than 30 characters',
        showError: false,
        isOptional: false,
        showErrorTooltip: true,
        errMessage:
          'Required, at 3 but less than 30 characters. <br/>Only alphabets, numbers, dashs, dot and underscore are allowed in the name.',
      },
      projectDesc: {
        text: 'Description',
        placeholder: 'optional',
        showError: false,
        isOptional: true,
        showErrorTooltip: false,
        errMessage: '',
      },
    },
    validInputs: {
      projectName: { isValid: false, error: 'Project/Run Name input error.' },
    },
    init: {
      validForm: false,
      errMessage: null,
      projectName: null,
      projectDesc: null,
    },
  },
  sraAccessionInput: {
    params: {
      accessions: {
        text: 'SRA Accession(s)',
        tooltip: 'Input SRA accessions (comma separate for > 1 input)',
        placeholder: 'ex: SRR1553609',
        showError: false,
        isOptional: false,
        toUpperCase: true,
        errMessage: 'Invalid SRA accession(s) input',
      },
    },
    validInputs: {
      accessions: { isValid: false, error: 'Invalid SRA accession(s) input' },
    },
    init: {
      validForm: false,
      errMessage: null,
      accessions: [],
      accessions_display: '',
    },
  },
  inputRawReads: {
    validForm: false,
    errMessage: 'input error',
    files: [],
    inputs: {
      source: {
        text: 'Input Source',
        value: 'fastq',
        display: 'READS/FASTQ',
        options: [
          { text: 'READS/FASTQ', value: 'fastq' },
          { text: 'CONTIGS/FASTA', value: 'fasta' },
          { text: 'NCBI SRA', value: 'sra' },
        ],
      },
      seqPlatform: {
        text: 'Sequencing Platform',
        value: 'Illumina',
        display: 'Illumina',
        tooltip:
          'Illumina: high-throughput, short-read sequencing with high accuracy. Nanopore and Pacbio: long reads sequencing technologies.',
        options: [
          { text: 'Nanopore', value: 'Nanopore' },
          { text: 'Illumina', value: 'Illumina' },
          { text: 'PacBio', value: 'PacBio' },
        ],
      },
      paired: {
        text: 'Paired-End?',
        value: true,
      },
      inputFiles: {
        text: ' Files',
        value: [],
        display: [],
      },
    },
    fastqInput: {
      text: 'Fastq File',
      tooltip:
        'Either paired-end Illumina data or single-end data from various sequencing platforms in FASTQ format as the input; the file can be becompressed. <br/>Acceptable file name extensions: .fastq, .fq, .fastq.gz, .fq.gz<br />Note: The file size limit for the URL input is 10GB',
      enableInput: true,
      placeholder: 'Select a file or enter a file http(s) url',
      dataSources: ['upload', 'public'],
      fileTypes: ['fastq', 'fq', 'fastq.gz', 'fq.gz'],
      projectTypes: [],
      projectScope: ['self+shared'],
      viewFile: false,
      isOptional: false,
      cleanupInput: true,
      maxInput: 1000,
    },
    fastaInput: {
      text: 'Contig Fasta File',
      tooltip:
        'Acceptable file name extensions: .fasta, .fa, .fna, .contigs<br />Note: The file size limit for the URL input is 10GB',
      enableInput: true,
      placeholder: 'Select a file or enter a file http(s) url',
      dataSources: ['upload', 'public'],
      fileTypes: ['fasta', 'fa', 'fna', 'contigs'],
      projectTypes: [],
      projectScope: ['self+shared'],
      viewFile: false,
      isOptional: false,
      cleanupInput: true,
      maxInput: 1000,
    },
    sraInput: {
      text: 'SRA Accession(s)',
      isOptional: false,
      note: '<span className="text-muted edge-text-size-small"> \
    (Internet required) Input SRA accessions (comma separate for &gt; 1 input) support studies (SRP*/ERP*/DRP*), \
    experiments (SRX*/ERX*/DRX*), samples (SRS*/ERS*/DRS*), runs (SRR*/ERR*/DRR*), or submissions (SRA*/ERA*/DRA*). \
    ex: <a target="_blank" href="https://www.ncbi.nlm.nih.gov/sra/?term=SRR1553609" rel="noopener noreferrer">SRR1553609</a> \
    </span>',
    },
    // only for input with validation method
    validInputs: {
      inputFiles: { isValid: false, error: 'Data input error.' },
    },
  },
}
