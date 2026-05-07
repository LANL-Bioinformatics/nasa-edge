import pako from 'pako'

export const FASTQ_PLATFORM = {
  ILLUMINA: 'Illumina',
  NANOPORE: 'Nanopore',
  PACBIO: 'PacBio',
  UNKNOWN: 'Unknown',
}

export const FASTQ_LAYOUT = {
  SINGLE: 'single',
  TWO_FILE: 'two-file',
  INTERLEAVED: 'interleaved',
  UNKNOWN: 'unknown',
}

const DEFAULT_CHUNK_SIZE = 64 * 1024
const DEFAULT_LONG_READ_THRESHOLD = 400
const DEFAULT_MAX_COMPRESSED_BYTES = 64 * 1024 * 1024
const DEFAULT_SAMPLE_RECORDS = 1000
const DEFAULT_SAMPLE_PAIRS = 1000

const ILLUMINA_PATTERNS = [
  /^@[^:\s]*:\d+:[^:\s]+:\d+:\d+:\d+:\d+\s+[12]:[YN]:\d+:\S+/i,
  /^@[^:\s]*:\d+:\d+:\d+:\d+#?[A-Z0-9]*\/[12]/i,
  /^@[^:\s]*:\d+:[^:\s]+:\d+:\d+:\d+:\d+/i,
]

const NANOPORE_PATTERNS = [
  /^@[a-f0-9-]{20,}\s+.*\brunid=/i,
  /\brunid=[a-f0-9]+/i,
  /\bread=\d+/i,
  /\bch=\d+/i,
  /\bstart_time=/i,
  /^@[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
]

const PACBIO_PATTERNS = [
  /^@[^/\s]+\/\d+\/\d+_\d+/i,
  /^@[^/\s]+\/\d+\/ccs/i,
  /\/ccs\b/i,
  /^@[^/\s]+\/\d+\//i,
]

const PLATFORM_PATTERNS = [
  { platform: FASTQ_PLATFORM.ILLUMINA, patterns: ILLUMINA_PATTERNS },
  { platform: FASTQ_PLATFORM.NANOPORE, patterns: NANOPORE_PATTERNS },
  { platform: FASTQ_PLATFORM.PACBIO, patterns: PACBIO_PATTERNS },
]

const buildOptions = (options = {}) => ({
  chunkSize: options.chunkSize || DEFAULT_CHUNK_SIZE,
  longReadThreshold: options.longReadThreshold || DEFAULT_LONG_READ_THRESHOLD,
  maxCompressedBytes: options.maxCompressedBytes || DEFAULT_MAX_COMPRESSED_BYTES,
  sampleRecords: options.sampleRecords || DEFAULT_SAMPLE_RECORDS,
  samplePairs: options.samplePairs || DEFAULT_SAMPLE_PAIRS,
  gzip: options.gzip,
  fetchOptions: options.fetchOptions || {},
})

const isBlob = (source) => typeof Blob !== 'undefined' && source instanceof Blob

const isFetchableString = (source) => typeof source === 'string' && source.trim() !== ''

export const normalizeFastqFetchUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return url
  }

  const trimmed = url.trim()
  if (
    trimmed.startsWith('/') ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ||
    trimmed.startsWith('#')
  ) {
    return trimmed
  }

  if (
    /^(uploads|projects|sradata|publicdata|bulksubmissions|workflow-docs)\//i.test(trimmed)
  ) {
    return `/${trimmed}`
  }

  return trimmed
}

const unwrapSource = (source) => {
  if (!source || isBlob(source) || isFetchableString(source)) {
    return source
  }

  return source.file || source.blob || source.url || source.path || source.href || source
}

const getSourceName = (source) => {
  if (!source) {
    return ''
  }
  if (typeof source === 'string') {
    return source
  }
  return (
    source.name || source.key || source.url || source.path || source.href || source.file?.name || ''
  )
}

const isGzipSource = (source, options) => {
  if (typeof options.gzip === 'boolean') {
    return options.gzip
  }

  const name = getSourceName(source).toLowerCase()
  const blob = unwrapSource(source)
  return name.endsWith('.gz') || name.endsWith('.gzip') || blob?.type === 'application/gzip'
}

async function* readBlobChunks(blob, options) {
  let offset = 0
  while (offset < blob.size) {
    const end = Math.min(offset + options.chunkSize, blob.size)
    const buffer = await blob.slice(offset, end).arrayBuffer()
    offset = end
    yield new Uint8Array(buffer)
  }
}

async function* readUrlChunks(rawUrl, options) {
  const url = normalizeFastqFetchUrl(rawUrl)
  let offset = 0
  let done = false

  while (!done) {
    const headers = new Headers(options.fetchOptions.headers || {})
    headers.set('Range', `bytes=${offset}-${offset + options.chunkSize - 1}`)

    const response = await fetch(url, {
      ...options.fetchOptions,
      headers,
    })

    if (!response.ok && response.status !== 206) {
      throw new Error(`Unable to fetch FASTQ sample (${response.status})`)
    }

    const isRangeResponse = response.status === 206
    let bytesRead = 0

    if (!response.body) {
      if (!isRangeResponse) {
        throw new Error('FASTQ sampling requires streaming fetch or HTTP range support')
      }
      const buffer = await response.arrayBuffer()
      bytesRead = buffer.byteLength
      yield new Uint8Array(buffer)
    } else {
      const reader = response.body.getReader()
      try {
        while (true) {
          const { value, done: streamDone } = await reader.read()
          if (streamDone) {
            break
          }
          bytesRead += value.byteLength
          yield value
        }
      } finally {
        reader.cancel().catch(() => {})
      }
    }

    done = !isRangeResponse || bytesRead < options.chunkSize
    offset += bytesRead
  }
}

async function* readSourceChunks(source, options) {
  const dataSource = unwrapSource(source)
  if (isBlob(dataSource)) {
    yield* readBlobChunks(dataSource, options)
    return
  }

  if (isFetchableString(dataSource)) {
    yield* readUrlChunks(dataSource, options)
    return
  }

  throw new Error('FASTQ source must be a File, Blob, URL, or fetchable path')
}

const createFastqParser = () => {
  let buffer = ''
  let lines = []
  let lineNumber = 0

  const parseLine = (rawLine) => {
    lineNumber += 1
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    lines.push(line)

    if (lines.length < 4) {
      return null
    }

    const [header, sequence, plus, quality] = lines
    const recordStartLine = lineNumber - 3
    lines = []

    if (!header.startsWith('@')) {
      throw new Error(`Invalid FASTQ record at line ${recordStartLine}: header must start with @`)
    }
    if (!plus.startsWith('+')) {
      throw new Error(`Invalid FASTQ record at line ${recordStartLine + 2}: plus line expected`)
    }

    return {
      header,
      sequence,
      quality,
      sequenceLength: sequence.length,
      lineNumber: recordStartLine,
    }
  }

  const pushText = (text) => {
    const records = []
    if (!text) {
      return records
    }

    buffer += text
    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const record = parseLine(buffer.slice(0, newlineIndex))
      if (record) {
        records.push(record)
      }
      buffer = buffer.slice(newlineIndex + 1)
      newlineIndex = buffer.indexOf('\n')
    }
    return records
  }

  const finish = () => {
    const records = []
    if (buffer) {
      const record = parseLine(buffer)
      if (record) {
        records.push(record)
      }
      buffer = ''
    }

    if (lines.length > 0) {
      throw new Error('Incomplete FASTQ record at end of sampled file')
    }
    return records
  }

  return { pushText, finish }
}

export async function* readFastqRecords(source, options = {}) {
  const settings = buildOptions(options)
  const parser = createFastqParser()
  const gzip = isGzipSource(source, settings)
  const decoder = gzip ? null : new TextDecoder()
  let inflator = null
  let inflatedText = []
  let bytesRead = 0
  let recordsRead = 0

  if (gzip) {
    inflator = new pako.Inflate({ to: 'string' })
    inflator.onData = (chunk) => {
      inflatedText.push(chunk)
    }
  }

  const parseRecords = function* (text) {
    const records = parser.pushText(text)
    for (const record of records) {
      recordsRead += 1
      yield {
        ...record,
        recordNumber: recordsRead,
        source: getSourceName(source),
        longRead: record.sequenceLength > settings.longReadThreshold,
      }

      if (record.sequenceLength > settings.longReadThreshold) {
        return true
      }
      if (recordsRead >= settings.sampleRecords) {
        return true
      }
    }
    return false
  }

  for await (const chunk of readSourceChunks(source, settings)) {
    bytesRead += chunk.byteLength
    if (bytesRead > settings.maxCompressedBytes) {
      throw new Error('FASTQ sample exceeded the maximum compressed byte window')
    }

    if (gzip) {
      inflatedText = []
      inflator.push(chunk, false)
      if (inflator.err) {
        throw new Error(inflator.msg)
      }
      for (const text of inflatedText) {
        const shouldStop = yield* parseRecords(text)
        if (shouldStop) {
          return
        }
      }
    } else {
      const shouldStop = yield* parseRecords(decoder.decode(chunk, { stream: true }))
      if (shouldStop) {
        return
      }
    }
  }

  if (gzip) {
    inflatedText = []
    inflator.push(new Uint8Array(0), true)
    if (inflator.err) {
      throw new Error(inflator.msg)
    }
    for (const text of inflatedText) {
      yield* parseRecords(text)
    }
  } else {
    yield* parseRecords(decoder.decode())
  }

  const records = parser.finish()
  for (const record of records) {
    recordsRead += 1
    yield {
      ...record,
      recordNumber: recordsRead,
      source: getSourceName(source),
      longRead: record.sequenceLength > settings.longReadThreshold,
    }
  }
}

const normalizeReadName = (header) => {
  const body = header.startsWith('@') ? header.slice(1) : header
  const [nameToken, readToken] = body.trim().split(/\s+/, 2)
  let name = nameToken
  let read = null

  const slashRead = name.match(/^(.+)\/([12])$/)
  if (slashRead) {
    name = slashRead[1]
    read = slashRead[2]
  }

  if (!read && readToken) {
    const casavaRead = readToken.match(/^([12]):[YN]:\d+:/i)
    if (casavaRead) {
      read = casavaRead[1]
    }
  }

  return { name, read, raw: header }
}

const comparePairNames = (left, right, pairNumber) => {
  const leftName = normalizeReadName(left.header)
  const rightName = normalizeReadName(right.header)

  if (leftName.name !== rightName.name) {
    return {
      matched: false,
      reason: `FASTQ read name mismatch at pair ${pairNumber}`,
      left: leftName,
      right: rightName,
    }
  }

  if (leftName.read && leftName.read !== '1') {
    return {
      matched: false,
      reason: `Expected R1 read marker at pair ${pairNumber}`,
      left: leftName,
      right: rightName,
    }
  }

  if (rightName.read && rightName.read !== '2') {
    return {
      matched: false,
      reason: `Expected R2 read marker at pair ${pairNumber}`,
      left: leftName,
      right: rightName,
    }
  }

  if (leftName.read && rightName.read && leftName.read === rightName.read) {
    return {
      matched: false,
      reason: `FASTQ pair has duplicate read marker at pair ${pairNumber}`,
      left: leftName,
      right: rightName,
    }
  }

  return {
    matched: true,
    left: leftName,
    right: rightName,
  }
}

export const detectFastqPlatform = (headers = []) => {
  const scores = {
    [FASTQ_PLATFORM.ILLUMINA]: 0,
    [FASTQ_PLATFORM.NANOPORE]: 0,
    [FASTQ_PLATFORM.PACBIO]: 0,
  }

  headers.forEach((header) => {
    PLATFORM_PATTERNS.forEach(({ platform, patterns }) => {
      if (patterns.some((pattern) => pattern.test(header))) {
        scores[platform] += 1
      }
    })
  })

  const platform = Object.keys(scores).reduce(
    (best, current) => (scores[current] > scores[best] ? current : best),
    FASTQ_PLATFORM.ILLUMINA,
  )

  return {
    platform: scores[platform] > 0 ? platform : FASTQ_PLATFORM.UNKNOWN,
    scores,
  }
}

const baseResult = (sources, options) => ({
  ok: true,
  isPaired: false,
  layout: FASTQ_LAYOUT.UNKNOWN,
  platform: FASTQ_PLATFORM.UNKNOWN,
  platformScores: {
    [FASTQ_PLATFORM.ILLUMINA]: 0,
    [FASTQ_PLATFORM.NANOPORE]: 0,
    [FASTQ_PLATFORM.PACBIO]: 0,
  },
  recordsChecked: 0,
  pairsChecked: 0,
  longReadDetected: false,
  maxReadLength: 0,
  earlyExit: false,
  sampleRecords: options.sampleRecords,
  samplePairs: options.samplePairs,
  sources: sources.map(getSourceName),
  reason: null,
})

const applyPlatform = (result, headers) => {
  const detected = detectFastqPlatform(headers)
  result.platform = detected.platform
  result.platformScores = detected.scores
  return result
}

const markLongRead = (result, record) => {
  result.longReadDetected = true
  result.earlyExit = true
  result.reason = `Read length ${record.sequenceLength} exceeds longReadThreshold`
  result.layout = FASTQ_LAYOUT.SINGLE
  result.isPaired = false
}

const inspectTwoFileFastq = async (sources, options) => {
  const result = baseResult(sources, options)
  const headers = []
  const leftReader = readFastqRecords(sources[0], {
    ...options,
    sampleRecords: options.samplePairs,
  })
  const rightReader = readFastqRecords(sources[1], {
    ...options,
    sampleRecords: options.samplePairs,
  })

  while (result.pairsChecked < options.samplePairs) {
    const [leftNext, rightNext] = await Promise.all([leftReader.next(), rightReader.next()])

    if (leftNext.done && rightNext.done) {
      break
    }

    if (leftNext.done || rightNext.done) {
      result.earlyExit = true
      result.reason = `FASTQ pair ${result.pairsChecked + 1} is missing an R${
        leftNext.done ? '1' : '2'
      } record`
      break
    }

    const left = leftNext.value
    const right = rightNext.value
    headers.push(left.header, right.header)
    result.recordsChecked += 2
    result.maxReadLength = Math.max(result.maxReadLength, left.sequenceLength, right.sequenceLength)

    if (left.longRead || right.longRead) {
      markLongRead(result, left.longRead ? left : right)
      break
    }

    const nameCheck = comparePairNames(left, right, result.pairsChecked + 1)
    if (!nameCheck.matched) {
      result.earlyExit = true
      result.reason = nameCheck.reason
      result.mismatch = nameCheck
      break
    }

    result.pairsChecked += 1
  }

  if (!result.reason && result.pairsChecked > 0) {
    result.isPaired = true
    result.layout = FASTQ_LAYOUT.TWO_FILE
    result.reason = `Checked ${result.pairsChecked} FASTQ pair(s)`
  } else if (!result.reason) {
    result.layout = FASTQ_LAYOUT.SINGLE
    result.reason = 'No FASTQ records were found'
  }

  return applyPlatform(result, headers)
}

const inspectSingleFastq = async (source, options) => {
  const result = baseResult([source], options)
  const headers = []
  const reader = readFastqRecords(source, {
    ...options,
    sampleRecords: options.samplePairs * 2,
  })

  let pending = null
  while (result.pairsChecked < options.samplePairs) {
    const next = await reader.next()
    if (next.done) {
      break
    }

    const record = next.value
    headers.push(record.header)
    result.recordsChecked += 1
    result.maxReadLength = Math.max(result.maxReadLength, record.sequenceLength)

    if (record.longRead) {
      markLongRead(result, record)
      break
    }

    if (!pending) {
      pending = record
      continue
    }

    const nameCheck = comparePairNames(pending, record, result.pairsChecked + 1)
    if (!nameCheck.matched) {
      result.earlyExit = true
      result.layout = FASTQ_LAYOUT.SINGLE
      result.reason = nameCheck.reason
      result.mismatch = nameCheck
      break
    }

    result.pairsChecked += 1
    pending = null
  }

  if (!result.reason && result.pairsChecked > 0 && !pending) {
    result.isPaired = true
    result.layout = FASTQ_LAYOUT.INTERLEAVED
    result.reason = `Checked ${result.pairsChecked} interleaved FASTQ pair(s)`
  } else if (!result.reason) {
    result.isPaired = false
    result.layout = FASTQ_LAYOUT.SINGLE
    result.reason =
      result.recordsChecked === 0
        ? 'No FASTQ records were found'
        : `Checked ${result.recordsChecked} FASTQ record(s)`
  }

  return applyPlatform(result, headers)
}

export const inspectFastqFiles = async (sources, options = {}) => {
  const sourceList = (Array.isArray(sources) ? sources : [sources]).filter(Boolean)
  const settings = buildOptions(options)

  if (sourceList.length === 0) {
    throw new Error('At least one FASTQ source is required')
  }
  if (sourceList.length > 2) {
    throw new Error('FASTQ inspection supports one interleaved file or one R1/R2 file pair')
  }

  if (sourceList.length === 2) {
    return inspectTwoFileFastq(sourceList, settings)
  }

  return inspectSingleFastq(sourceList[0], settings)
}
