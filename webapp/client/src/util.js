export const workflowList = {
  sra2fastq: {
    label: 'Download SRA Data',
    category: 'data',
    info: 'This tool retrieves sequence project in FASTQ files from NCBI- SRA / EBI - ENA / DDBJ database. Input accession number supports studies(SRP*/ ERP * /DRP*), experiments (SRX*/ERX * /DRX*), samples(SRS * /ERS*/DRS *), runs(SRR * /ERR*/DRR *), or submissions (SRA * /ERA*/DRA *).',
  },
  // Add more workflows here
  AmpIllumina: {
    label: 'AmpIllumina',
    category: 'nasa',
  },
}

// match colors in scss/edgescss
export const colors = {
  primary: '#5856d6',
  secondary: '#6b7785',
  success: '#1b9e3e',
  danger: '#e55353',
  warning: '#f9b115',
  info: '#39f',
  light: '#ebedef',
  gray: '#ced2d8',
  dark: '#212631',
  app: '#6a9e5d',
}
