const fs = require('fs')
const path = require('path')
const axios = require('axios')
const config = require('../../config')
const { getProject, getProjectResult } = require('./project')

const TEXT_ASSET_REGEX = /\.(html?|txt|tsv|csv|json|svg)(\?|#|$)/i
const IMAGE_ASSET_REGEX = /\.(png|jpe?g|webp)(\?|#|$)/i
const PDF_ASSET_REGEX = /\.pdf(\?|#|$)/i
const MAX_ASSETS = 20
const MAX_ARRAY_ITEMS = 50
const MAX_STRING_CHARS = 2000
const VALID_SECTION_KEYS = new Set([
  'runFaQCs',
  'assembly',
  'annotation',
  'binning',
  'antiSmash',
  'taxonomy',
  'phylogeny',
  'refBased',
  'geneFamily',
])

const trimTrailingSlash = value => value.replace(/\/+$/, '')

const truncateText = (value, maxChars) => {
  if (!value || value.length <= maxChars) {
    return value || ''
  }

  return `${value.slice(0, maxChars)}\n[content truncated after ${maxChars} characters]`
}

const cleanText = value => value.replace(/\s+/g, ' ').trim()

const htmlToText = value => {
  const inlineScriptText = Array.from(
    value.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
  )
    .map(match => match[1])
    .filter(Boolean)
    .join(' ')

  return cleanText(
    [
      value
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
      inlineScriptText,
    ].join(' '),
  )
}

const svgToText = value =>
  cleanText(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )

const compactValue = (value, depth = 0) => {
  if (depth > 6) {
    return '[nested content omitted]'
  }

  if (Array.isArray(value)) {
    const compactItems = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map(item => compactValue(item, depth + 1))

    if (value.length > MAX_ARRAY_ITEMS) {
      compactItems.push(`[${value.length - MAX_ARRAY_ITEMS} additional rows omitted]`)
    }

    return compactItems
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        compactValue(item, depth + 1),
      ]),
    )
  }

  if (typeof value === 'string') {
    return truncateText(value, MAX_STRING_CHARS)
  }

  return value
}

const getAssetType = value => {
  if (TEXT_ASSET_REGEX.test(value)) {
    return 'text'
  }

  if (IMAGE_ASSET_REGEX.test(value)) {
    return 'image'
  }

  if (PDF_ASSET_REGEX.test(value)) {
    return 'pdf'
  }

  return undefined
}

const collectAssets = result => {
  const assets = []
  const seenSources = new Set()

  const visit = (value, sourcePath = 'result') => {
    if (assets.length >= MAX_ASSETS) {
      return
    }

    if (typeof value === 'string') {
      const assetType = getAssetType(value)
      if (!assetType || seenSources.has(value)) {
        return
      }

      seenSources.add(value)
      assets.push({ path: sourcePath, source: value, type: assetType })
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${sourcePath}[${index}]`))
      return
    }

    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) =>
        visit(item, `${sourcePath}.${key}`),
      )
    }
  }

  visit(result)

  return assets
}

const stripQuery = value => value.split(/[?#]/)[0]

const normalizeRelativePath = value =>
  stripQuery(value).replace(/^\/+/, '').replace(/\\/g, '/')

const resolveUnderBase = (baseDir, relativePath) => {
  const resolvedBase = path.resolve(baseDir)
  const resolvedPath = path.resolve(resolvedBase, relativePath)

  if (
    resolvedPath !== resolvedBase &&
    !resolvedPath.startsWith(`${resolvedBase}${path.sep}`)
  ) {
    return null
  }

  return resolvedPath
}

const resolveAssetFile = (asset, project) => {
  if (/^https?:\/\//i.test(asset.source)) {
    return null
  }

  const source = normalizeRelativePath(asset.source)
  const projectPrefix = `projects/${project.code}/`

  if (source.startsWith(projectPrefix)) {
    return resolveUnderBase(
      path.join(config.IO.PROJECT_BASE_DIR, project.code),
      source.slice(projectPrefix.length),
    )
  }

  if (source.startsWith('opaver_web/')) {
    return resolveUnderBase(
      config.IO.OPAVER_WEB_BASE_DIR,
      source.replace(/^opaver_web\//, ''),
    )
  }

  if (source.startsWith('jbrowse2/')) {
    return resolveUnderBase(
      config.IO.JBROWSE2_BASE_DIR,
      source.replace(/^jbrowse2\//, ''),
    )
  }

  if (source.startsWith('workflow-docs/')) {
    return resolveUnderBase(
      config.IO.WORKFLOW_DOCS_DIR,
      source.replace(/^workflow-docs\//, ''),
    )
  }

  if (source.startsWith('tmp/')) {
    return resolveUnderBase(config.IO.TMP_BASE_DIR, source.replace(/^tmp\//, ''))
  }

  return resolveUnderBase(path.join(config.IO.PROJECT_BASE_DIR, project.code), source)
}

const readTextAsset = asset => {
  const filePath = asset.filePath

  if (!filePath) {
    return {
      ...asset,
      text: `[not fetched because the file is outside the configured project/static directories: ${asset.source}]`,
    }
  }

  if (!fs.existsSync(filePath)) {
    return {
      ...asset,
      text: `[could not read ${asset.source}: file not found]`,
    }
  }

  try {
    const rawText = fs.readFileSync(filePath, 'utf8')
    const text = /\.svg(\?|#|$)/i.test(asset.source)
      ? svgToText(rawText)
      : /\.html?(\?|#|$)/i.test(asset.source)
        ? htmlToText(rawText)
        : cleanText(rawText)

    return {
      ...asset,
      text: truncateText(text, config.AI_SUMMARY.MAX_FETCH_CHARS),
    }
  } catch (err) {
    return {
      ...asset,
      text: `[could not read ${asset.source}: ${err.message || 'read failed'}]`,
    }
  }
}

const readImagePart = asset => {
  if (!config.AI_SUMMARY.INCLUDE_IMAGES || !asset.filePath) {
    return undefined
  }

  try {
    if (!fs.existsSync(asset.filePath)) {
      return undefined
    }

    const stats = fs.statSync(asset.filePath)
    if (stats.size > config.AI_SUMMARY.MAX_IMAGE_BYTES) {
      return undefined
    }

    const bytes = fs.readFileSync(asset.filePath)
    const ext = path.extname(asset.filePath).toLowerCase()
    const mimeType =
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/${ext.slice(1)}`

    return {
      label: `${asset.path}: ${asset.source}`,
      part: {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${bytes.toString('base64')}`,
        },
      },
    }
  } catch {
    return undefined
  }
}

const getSystemContent = sectionKey =>
  config.AI_SUMMARY.SECTION_SYSTEM_CONTENT[sectionKey] ||
  config.AI_SUMMARY.SYSTEM_CONTENT_DEFAULT

const getSectionResult = (project, projectResult, sectionKey) => {
  if (project.type === 'metagenomics') {
    return projectResult[sectionKey] || {}
  }

  if (project.type === sectionKey) {
    return projectResult || {}
  }

  return {}
}

const getSummaryFilePath = project =>
  path.join(config.IO.PROJECT_BASE_DIR, project.code, 'ai_summary.json')

const readProjectAISummaries = project => {
  const summaryFile = getSummaryFilePath(project)

  if (!fs.existsSync(summaryFile)) {
    return {}
  }

  try {
    return JSON.parse(fs.readFileSync(summaryFile, 'utf8'))
  } catch {
    return {}
  }
}

const getCachedAISummary = (project, sectionKey) => {
  const cached = readProjectAISummaries(project)[sectionKey]

  if (!cached) {
    return null
  }

  if (typeof cached === 'string') {
    return { summary: cached }
  }

  if (cached.summary) {
    return cached
  }

  return null
}

const saveProjectAISummary = ({ project, sectionKey, title, summary, user }) => {
  const summaries = readProjectAISummaries(project)
  const summaryRecord = {
    title,
    summary,
    model: config.AI_SUMMARY.MODEL,
    generatedBy: user ? user.email : undefined,
    updated: new Date().toISOString(),
  }
  summaries[sectionKey] = summaryRecord

  fs.writeFileSync(getSummaryFilePath(project), JSON.stringify(summaries, null, 2))

  return summaryRecord
}

const buildUserContent = ({ title, sectionKey, project, sectionResult, includeImages }) => {
  const assets = collectAssets(sectionResult).map(asset => ({
    ...asset,
    filePath: resolveAssetFile(asset, project),
  }))
  const textAssets = assets
    .filter(asset => asset.type === 'text')
    .map(asset => readTextAsset(asset))
  const imageParts = includeImages
    ? assets
        .filter(asset => asset.type === 'image')
        .map(asset => readImagePart(asset))
        .filter(Boolean)
    : []
  const skippedAssets = assets.filter(
    asset =>
      asset.type === 'pdf' ||
      (asset.type === 'image' &&
        !imageParts.some(imageAsset => imageAsset.label.includes(asset.source))),
  )
  const compactResult = JSON.stringify(compactValue(sectionResult || {}), null, 2)
  const projectLabel = [project.name, project.code].filter(Boolean).join(' / ')
  const textSections = [
    `Section: ${title}`,
    `Section key: ${sectionKey}`,
    projectLabel ? `Project: ${projectLabel}` : '',
    `Structured result data:\n${compactResult}`,
    textAssets.length
      ? `Fetched linked result text/html/svg:\n${textAssets
          .map(
            asset =>
              `File: ${asset.source}\nPath: ${asset.filePath || 'not available'}\nContent: ${asset.text}`,
          )
          .join('\n\n')}`
      : '',
    imageParts.length
      ? `Included linked figure images:\n${imageParts
          .map(asset => asset.label)
          .join('\n')}`
      : '',
    skippedAssets.length
      ? `Linked files not directly read as text:\n${skippedAssets
          .map(asset => `${asset.source} (${asset.type})`)
          .join('\n')}`
      : '',
  ].filter(Boolean)
  const text = truncateText(textSections.join('\n\n'), config.AI_SUMMARY.MAX_USER_CHARS)

  if (includeImages && imageParts.length > 0) {
    return {
      hasImages: true,
      content: [{ type: 'text', text }, ...imageParts.map(asset => asset.part)],
    }
  }

  return { hasImages: false, content: text }
}

const extractResponseText = data => {
  const messageContent =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content

  if (typeof messageContent === 'string') {
    return messageContent.trim()
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map(part => (part && (part.text || part.content)) || '')
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  if (data && typeof data.output_text === 'string') {
    return data.output_text.trim()
  }

  return ''
}

const shouldRetryWithoutImages = error =>
  !/(401|403|api key|auth|permission|quota|rate limit)/i.test(
    error.message || '',
  )

const requestAISummary = async ({ systemContent, userContent }) => {
  const baseUrl = trimTrailingSlash(config.AI_SUMMARY.BASE_URL)
  const pathName = config.AI_SUMMARY.CHAT_COMPLETIONS_PATH.startsWith('/')
    ? config.AI_SUMMARY.CHAT_COMPLETIONS_PATH
    : `/${config.AI_SUMMARY.CHAT_COMPLETIONS_PATH}`

  const response = await axios.post(
    `${baseUrl}${pathName}`,
    {
      model: config.AI_SUMMARY.MODEL,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
      temperature: config.AI_SUMMARY.TEMPERATURE,
      max_tokens: config.AI_SUMMARY.MAX_OUTPUT_TOKENS,
    },
    {
      headers: {
        Authorization: `Bearer ${config.AI_SUMMARY.API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: config.AI_SUMMARY.REQUEST_TIMEOUT_MS,
    },
  )
  const responseText = extractResponseText(response.data)

  if (!responseText) {
    throw new Error('The AI model returned an empty response.')
  }

  return responseText
}

const generateProjectAISummary = async ({ code, type, req }) => {
  const sectionKey = req.body.sectionKey
  const title = req.body.title || 'Workflow Result'
  const regenerate = req.body.regenerate === true

  if (!config.AI_SUMMARY.IS_ENABLED) {
    const err = new Error('AI summary is disabled on the server.')
    err.status = 400
    throw err
  }

  if (!VALID_SECTION_KEYS.has(sectionKey)) {
    const err = new Error('Invalid AI summary section.')
    err.status = 400
    throw err
  }

  const project = await getProject(code, type, req.user)
  if (!project) {
    const err = new Error(`project ${code} not found or access denied`)
    err.status = 400
    throw err
  }

  const isAdminRequest = type === 'admin' && req.user && req.user.role === 'admin'
  const isProjectOwner = req.user && project.owner === req.user.email

  if (!isProjectOwner && !isAdminRequest) {
    const err = new Error(
      'Only the project owner or an admin can generate an AI summary.',
    )
    err.status = 403
    throw err
  }

  if (!regenerate) {
    const cachedSummary = getCachedAISummary(project, sectionKey)
    if (cachedSummary) {
      return {
        ...cachedSummary,
        cached: true,
      }
    }
  }

  if (!config.AI_SUMMARY.API_KEY || !config.AI_SUMMARY.MODEL) {
    const err = new Error('AI summary is missing server configuration.')
    err.status = 400
    throw err
  }

  const projectResult = await getProjectResult(code, type, req)
  const sectionResult = getSectionResult(project, projectResult, sectionKey)
  const systemContent = getSystemContent(sectionKey)
  const contentWithImages = buildUserContent({
    title,
    sectionKey,
    project,
    sectionResult,
    includeImages: config.AI_SUMMARY.INCLUDE_IMAGES,
  })

  let summary
  try {
    summary = await requestAISummary({
      systemContent,
      userContent: contentWithImages.content,
    })
  } catch (err) {
    if (!contentWithImages.hasImages || !shouldRetryWithoutImages(err)) {
      throw err
    }

    const textOnlyContent = buildUserContent({
      title,
      sectionKey,
      project,
      sectionResult,
      includeImages: false,
    })

    summary = await requestAISummary({
      systemContent,
      userContent: textOnlyContent.content,
    })
  }

  const savedSummary = saveProjectAISummary({
    project,
    sectionKey,
    title,
    summary,
    user: req.user,
  })

  return {
    ...savedSummary,
    cached: false,
  }
}

module.exports = {
  generateProjectAISummary,
}
