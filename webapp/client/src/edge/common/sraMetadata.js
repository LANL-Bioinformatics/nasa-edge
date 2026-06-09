const SRA_EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

const PLATFORM_LABELS = {
  illumina: 'Illumina',
  nanopore: 'Nanopore',
  pacbio: 'PacBio',
}

const parseCsv = (text) => {
  const rows = []
  let row = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(value)
      value = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i += 1
      }
      row.push(value)
      if (row.some((cell) => cell.trim() !== '')) {
        rows.push(row)
      }
      row = []
      value = ''
    } else {
      value += char
    }
  }

  if (value !== '' || row.length > 0) {
    row.push(value)
    if (row.some((cell) => cell.trim() !== '')) {
      rows.push(row)
    }
  }

  return rows
}

const getHeaderIndex = (headers, name) =>
  headers.findIndex((header) => header.trim().toLowerCase() === name.toLowerCase())

const normalizePlatform = (platform) => {
  const value = (platform || '').toUpperCase()

  if (value.includes('ILLUMINA')) {
    return PLATFORM_LABELS.illumina
  }
  if (value.includes('NANOPORE') || value.includes('ONT')) {
    return PLATFORM_LABELS.nanopore
  }
  if (value.includes('PACBIO') || value.includes('SMRT')) {
    return PLATFORM_LABELS.pacbio
  }

  return null
}

const normalizeLayout = (layout) => {
  const value = (layout || '').toUpperCase()

  if (value.includes('PAIRED')) {
    return 'PAIRED'
  }
  if (value.includes('SINGLE')) {
    return 'SINGLE'
  }

  return null
}

const uniqueKnownValues = (values) =>
  [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))]

const summarizeRuns = (runs) => {
  const platforms = uniqueKnownValues(runs.map((run) => run.platform))
  const layouts = uniqueKnownValues(runs.map((run) => run.libraryLayout))

  return {
    runs,
    platform: platforms.length === 1 ? platforms[0] : null,
    libraryLayout: layouts.length === 1 ? layouts[0] : null,
    paired: layouts.length === 1 ? layouts[0] === 'PAIRED' : null,
    mixedPlatform: platforms.length > 1,
    mixedLayout: layouts.length > 1,
    platformValues: platforms,
    libraryLayoutValues: layouts,
  }
}

export const parseSraRunInfo = (runInfoText) => {
  const rows = parseCsv(runInfoText)

  if (rows.length < 2) {
    throw new Error('No SRA run metadata was returned.')
  }

  const headers = rows[0]
  const runIndex = getHeaderIndex(headers, 'Run')
  const platformIndex = getHeaderIndex(headers, 'Platform')
  const libraryLayoutIndex = getHeaderIndex(headers, 'LibraryLayout')
  const modelIndex = getHeaderIndex(headers, 'Model')

  if (platformIndex === -1 || libraryLayoutIndex === -1) {
    throw new Error('SRA metadata did not include platform or library layout fields.')
  }

  const runs = rows.slice(1).map((row) => {
    const platformRaw = row[platformIndex] || ''
    const libraryLayoutRaw = row[libraryLayoutIndex] || ''

    return {
      run: runIndex >= 0 ? row[runIndex] || '' : '',
      platformRaw,
      model: modelIndex >= 0 ? row[modelIndex] || '' : '',
      libraryLayoutRaw,
      platform: normalizePlatform(platformRaw),
      libraryLayout: normalizeLayout(libraryLayoutRaw),
    }
  })

  return summarizeRuns(runs)
}

const getXmlText = (xml, tagName) => {
  const node = xml.getElementsByTagName(tagName)[0]
  return node ? node.textContent : ''
}

const fetchText = async (url, signal) => {
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`NCBI request failed with status ${response.status}.`)
  }

  return response.text()
}

export const getSraMetadata = async (accessions, options = {}) => {
  const cleanAccessions = accessions.map((accession) => accession.trim()).filter(Boolean)

  if (cleanAccessions.length === 0) {
    throw new Error('No SRA accession was provided.')
  }

  const term = cleanAccessions.map((accession) => `"${accession}"`).join(' OR ')
  const esearchParams = new URLSearchParams({
    db: 'sra',
    term,
    usehistory: 'y',
    retmode: 'xml',
  })
  const esearchText = await fetchText(
    `${SRA_EUTILS_BASE}/esearch.fcgi?${esearchParams}`,
    options.signal,
  )
  const xml = new DOMParser().parseFromString(esearchText, 'application/xml')
  const webEnv = getXmlText(xml, 'WebEnv')
  const queryKey = getXmlText(xml, 'QueryKey')

  if (!webEnv || !queryKey) {
    throw new Error('NCBI did not return SRA search history for this accession.')
  }

  const efetchParams = new URLSearchParams({
    db: 'sra',
    rettype: 'runinfo',
    query_key: queryKey,
    WebEnv: webEnv,
    retmode: 'text',
  })
  const runInfoText = await fetchText(
    `${SRA_EUTILS_BASE}/efetch.fcgi?${efetchParams}`,
    options.signal,
  )

  return parseSraRunInfo(runInfoText)
}
