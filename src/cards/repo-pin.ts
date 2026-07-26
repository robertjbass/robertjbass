import type { ProfileData } from '../index.ts'
import {
  CARD_PADDING_X,
  CARD_WIDTH,
  COLORS,
  FONT_SIZE,
  PROMPT_LABEL_OFFSET_X,
  cardFrame,
  escapeXml,
  formatNumber,
  resolveColor,
  separator,
  svgText,
  type FontToken,
} from '../theme.ts'

const WIDTH = CARD_WIDTH.HALF
const CONTENT_WIDTH = WIDTH - CARD_PADDING_X * 2

const OWNER_OPACITY = 0.65

const DESCRIPTION_START_Y = 60
/** Font metrics are estimated, so wrap a little short of the true content edge. */
const DESCRIPTION_SAFETY_INSET = 4
const DESCRIPTION_LINE_HEIGHT = 17
const DESCRIPTION_MAX_LINES = 3
const EMPTY_DESCRIPTION = 'no description provided'
const PLACEHOLDER_OPACITY = 0.7

const FOOTER_RULE_OFFSET_Y = 14
const FOOTER_TEXT_OFFSET_Y = 20
const BOTTOM_PADDING_Y = 20

const LANGUAGE_DOT_OFFSET_X = 4
const LANGUAGE_DOT_OFFSET_Y = 4
const LANGUAGE_DOT_RADIUS = 3.5
const LANGUAGE_NAME_OFFSET_X = 15
const LANGUAGE_GUTTER = 12
const UNKNOWN_LANGUAGE = 'unclassified'

const ICON_SIZE = 12
const ICON_CENTER_OFFSET_Y = 4
const ICON_TEXT_GAP = 5
const STAT_GAP = 16
const COMPACT_THRESHOLD = 1000
/** Truncate rather than round so 3,968 reads as `3.9k`, never `4k`. */
const COMPACT_TRUNCATION_STEP = 100

const STAR_RADIUS = 5.6
const STAR_INNER_RATIO = 0.45
const STAR_POINTS = 5
const STAR_FADE_DURATION_SECONDS = 0.7
const STAR_FADE_DELAY_SECONDS = 0.2
const STAR_FADE_FROM_OPACITY = 0.35

const FORK_NODE_RADIUS = 1.7
const FORK_ARM_OFFSET_X = 4.4
const FORK_ARM_OFFSET_Y = 4.4
const FORK_BAR_OFFSET_Y = 0.6
const FORK_STROKE_WIDTH = 1.3

/**
 * Per-character ratios under-measure real -apple-system text by 4-6%, which put
 * wrapped descriptions past the content edge. Everything measured here is
 * inflated to cover that error.
 */
const MEASURE_SAFETY_FACTOR = 1.07

const MONO_ADVANCE_RATIO = 0.6
const UI_DEFAULT_RATIO = 0.55
const UI_UPPERCASE_RATIO = 0.68
const UI_DIGIT_RATIO = 0.56
const UI_ADVANCE_RATIOS: Record<string, number> = {
  ' ': 0.28,
  '!': 0.28,
  '"': 0.35,
  "'": 0.19,
  '(': 0.33,
  ')': 0.33,
  ',': 0.28,
  '-': 0.33,
  '.': 0.28,
  '/': 0.28,
  ':': 0.28,
  ';': 0.28,
  '[': 0.28,
  '\\': 0.28,
  ']': 0.28,
  '`': 0.33,
  f: 0.3,
  i: 0.24,
  j: 0.24,
  l: 0.24,
  m: 0.85,
  r: 0.35,
  t: 0.31,
  w: 0.72,
  '|': 0.26,
  I: 0.28,
  J: 0.5,
  L: 0.56,
  M: 0.83,
  T: 0.61,
  W: 0.94,
  Y: 0.67,
}

export type RepoPinOptions = {
  name: string
  owner?: string | null
  description?: string | null
  stars: number
  forks: number
  language?: { name: string; color: string | null } | null
  /** Prefixes the repo name with `owner/`. Defaults to true when an owner is given. */
  showOwner?: boolean
}

export function renderRepoPin(options: RepoPinOptions): string {
  const { name, owner, description, stars, forks, language } = options
  const showOwner = options.showOwner ?? Boolean(owner)

  const summary = cleanText(description)
  const lines = summary
    ? wrapText({
        text: summary,
        maxWidth: CONTENT_WIDTH - DESCRIPTION_SAFETY_INSET,
        maxLines: DESCRIPTION_MAX_LINES,
        size: FONT_SIZE.body,
        font: 'ui',
      })
    : [EMPTY_DESCRIPTION]
  const lastLineY =
    DESCRIPTION_START_Y + (lines.length - 1) * DESCRIPTION_LINE_HEIGHT
  const footerRuleY = lastLineY + FOOTER_RULE_OFFSET_Y
  const footerBaselineY = footerRuleY + FOOTER_TEXT_OFFSET_Y

  const stats = renderStats({ baselineY: footerBaselineY, stars, forks })

  const body = [
    ...renderDescription({ lines, placeholder: !summary }),
    separator({ y: footerRuleY, width: CONTENT_WIDTH }),
    renderLanguage({
      baselineY: footerBaselineY,
      language,
      maxRightX: stats.leftX - LANGUAGE_GUTTER,
    }),
    stats.markup,
  ].join('\n')

  return cardFrame({
    width: WIDTH,
    height: footerBaselineY + BOTTOM_PADDING_Y,
    title: titleMarkup({ name, owner: showOwner ? owner : null }),
    titleFont: 'mono',
    titleRaw: true,
    body,
    ariaLabel: ariaLabel({ name, owner, stars, forks, language }),
  })
}

export type RepoPinFile = {
  fileName: string
  svg: string
}

export function renderAllRepoPins(data: ProfileData): RepoPinFile[] {
  const repos = data.github?.repos ?? []
  const login = data.github?.login ?? ''
  const taken = new Set<string>()
  const files: RepoPinFile[] = []

  for (const repo of repos) {
    const preferred = repoPinFileName({ name: repo.name })
    const fileName = taken.has(preferred)
      ? repoPinFileName({
          name: repo.name,
          owner: repo.owner,
          includeOwner: true,
        })
      : preferred
    if (taken.has(fileName)) continue
    taken.add(fileName)

    files.push({
      fileName,
      svg: renderRepoPin({
        name: repo.name,
        owner: repo.owner,
        description: repo.description,
        stars: repo.stars,
        forks: repo.forks,
        language: repo.language,
        showOwner: !isSameOwner({ owner: repo.owner, login }),
      }),
    })
  }

  return files
}

export function repoPinFileName(options: {
  name: string
  owner?: string | null
  includeOwner?: boolean
}): string {
  const { name, owner, includeOwner = false } = options
  const base = includeOwner && owner ? `${owner}-${name}` : name
  return `pin-${slugify(base)}.svg`
}

function titleMarkup(options: { name: string; owner?: string | null }): string {
  const { name, owner } = options
  const maxWidth = CONTENT_WIDTH - PROMPT_LABEL_OFFSET_X
  const size = FONT_SIZE.title

  const withOwner = owner ? `${owner}/${name}` : name
  const fits = measureText({ text: withOwner, size, font: 'mono' }) <= maxWidth
  const prefix = fits && owner ? `${owner}/` : ''
  const label = truncateToWidth({
    text: name,
    maxWidth: maxWidth - measureText({ text: prefix, size, font: 'mono' }),
    size,
    font: 'mono',
  })

  if (!prefix) return escapeXml(label)
  return `<tspan fill="${COLORS.body}" opacity="${OWNER_OPACITY}">${escapeXml(prefix)}</tspan>${escapeXml(label)}`
}

function renderDescription(options: {
  lines: string[]
  placeholder: boolean
}): string[] {
  const { lines, placeholder } = options

  return lines.map((line, index) =>
    svgText({
      content: line,
      x: CARD_PADDING_X,
      y: DESCRIPTION_START_Y + index * DESCRIPTION_LINE_HEIGHT,
      size: FONT_SIZE.body,
      font: placeholder ? 'mono' : 'ui',
      opacity: placeholder ? PLACEHOLDER_OPACITY : undefined,
    }),
  )
}

function renderLanguage(options: {
  baselineY: number
  language?: { name: string; color: string | null } | null
  maxRightX: number
}): string {
  const { baselineY, language, maxRightX } = options
  const nameX = CARD_PADDING_X + LANGUAGE_NAME_OFFSET_X
  const label = truncateToWidth({
    text: language?.name ?? UNKNOWN_LANGUAGE,
    maxWidth: Math.max(0, maxRightX - nameX),
    size: FONT_SIZE.body,
    font: 'ui',
  })

  return [
    `<circle cx="${CARD_PADDING_X + LANGUAGE_DOT_OFFSET_X}" cy="${baselineY - LANGUAGE_DOT_OFFSET_Y}" r="${LANGUAGE_DOT_RADIUS}" fill="${language?.color ?? resolveColor('body')}" />`,
    svgText({
      content: label,
      x: nameX,
      y: baselineY,
      fill: language ? 'value' : 'body',
      size: FONT_SIZE.body,
      opacity: language ? 0.9 : 0.7,
    }),
  ].join('\n')
}

function renderStats(options: {
  baselineY: number
  stars: number
  forks: number
}): { markup: string; leftX: number } {
  const { baselineY, stars, forks } = options
  const size = FONT_SIZE.body
  const centerY = baselineY - ICON_CENTER_OFFSET_Y
  const rightX = WIDTH - CARD_PADDING_X

  const forkLabel = statLabel(forks)
  const forkIconX =
    rightX -
    measureText({ text: forkLabel, size, font: 'mono' }) -
    ICON_TEXT_GAP -
    ICON_SIZE

  const starLabel = statLabel(stars)
  const starRightX = forkIconX - STAT_GAP
  const starIconX =
    starRightX -
    measureText({ text: starLabel, size, font: 'mono' }) -
    ICON_TEXT_GAP -
    ICON_SIZE

  const markup = [
    starGlyph({ x: starIconX, centerY }),
    svgText({
      content: starLabel,
      x: starRightX,
      y: baselineY,
      fill: 'value',
      size,
      font: 'mono',
      anchor: 'end',
    }),
    forkGlyph({ x: forkIconX, centerY }),
    svgText({
      content: forkLabel,
      x: rightX,
      y: baselineY,
      fill: 'value',
      size,
      font: 'mono',
      anchor: 'end',
    }),
  ].join('\n')

  return { markup, leftX: starIconX }
}

function statLabel(value: number): string {
  const safe = Math.max(0, Math.round(value))
  if (safe < COMPACT_THRESHOLD) return formatNumber(safe)
  const truncated =
    Math.floor(safe / COMPACT_TRUNCATION_STEP) * COMPACT_TRUNCATION_STEP
  return formatNumber(truncated, { compact: true })
}

function starGlyph(options: { x: number; centerY: number }): string {
  const { x, centerY } = options
  const centerX = x + ICON_SIZE / 2
  const points: string[] = []

  for (let index = 0; index < STAR_POINTS * 2; index += 1) {
    const distance =
      index % 2 === 0 ? STAR_RADIUS : STAR_RADIUS * STAR_INNER_RATIO
    const angle = -Math.PI / 2 + (index * Math.PI) / STAR_POINTS
    points.push(
      `${round(centerX + Math.cos(angle) * distance)},${round(centerY + Math.sin(angle) * distance)}`,
    )
  }

  return [
    `<polygon points="${points.join(' ')}" fill="${COLORS.accentAlt}">`,
    `<animate attributeName="opacity" from="${STAR_FADE_FROM_OPACITY}" to="1" dur="${STAR_FADE_DURATION_SECONDS}s" begin="${STAR_FADE_DELAY_SECONDS}s" fill="freeze" />`,
    '</polygon>',
  ].join('')
}

function forkGlyph(options: { x: number; centerY: number }): string {
  const { x, centerY } = options
  const centerX = x + ICON_SIZE / 2
  const leftX = round(centerX - FORK_ARM_OFFSET_X)
  const rightX = round(centerX + FORK_ARM_OFFSET_X)
  const topY = round(centerY - FORK_ARM_OFFSET_Y)
  const bottomY = round(centerY + FORK_ARM_OFFSET_Y)
  const barY = round(centerY - FORK_BAR_OFFSET_Y)

  return [
    `<path d="M${leftX} ${topY} V${barY} H${rightX} V${topY} M${round(centerX)} ${barY} V${bottomY}" fill="none" stroke="${COLORS.accentAlt}" stroke-width="${FORK_STROKE_WIDTH}" stroke-linecap="round" />`,
    `<circle cx="${leftX}" cy="${topY}" r="${FORK_NODE_RADIUS}" fill="${COLORS.accentAlt}" />`,
    `<circle cx="${rightX}" cy="${topY}" r="${FORK_NODE_RADIUS}" fill="${COLORS.accentAlt}" />`,
    `<circle cx="${round(centerX)}" cy="${bottomY}" r="${FORK_NODE_RADIUS}" fill="${COLORS.accentAlt}" />`,
  ].join('\n')
}

function wrapText(options: {
  text: string
  maxWidth: number
  maxLines: number
  size: number
  font: FontToken
}): string[] {
  const { text, maxWidth, maxLines, size, font } = options
  const lines = wrapAllLines({ text, maxWidth, size, font })
  if (lines.length <= maxLines) return lines

  const visible = lines.slice(0, maxLines)
  visible[maxLines - 1] = truncateToWidth({
    text: lines.slice(maxLines - 1).join(' '),
    maxWidth,
    size,
    font,
  })
  return visible
}

function wrapAllLines(options: {
  text: string
  maxWidth: number
  size: number
  font: FontToken
}): string[] {
  const { text, maxWidth, size, font } = options
  const lines: string[] = []
  let current = ''

  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word
    if (measureText({ text: candidate, size, font }) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) {
      lines.push(current)
      current = ''
    }

    if (measureText({ text: word, size, font }) <= maxWidth) {
      current = word
      continue
    }

    let chunk = ''
    for (const character of word) {
      if (
        chunk &&
        measureText({ text: chunk + character, size, font }) > maxWidth
      ) {
        lines.push(chunk)
        chunk = ''
      }
      chunk += character
    }
    current = chunk
  }

  if (current) lines.push(current)
  return lines
}

function truncateToWidth(options: {
  text: string
  maxWidth: number
  size: number
  font: FontToken
}): string {
  const { text, maxWidth, size, font } = options
  if (measureText({ text, size, font }) <= maxWidth) return text

  const ellipsis = '…'
  const characters = [...text]
  while (characters.length > 0) {
    characters.pop()
    const candidate = `${characters.join('').trimEnd()}${ellipsis}`
    if (measureText({ text: candidate, size, font }) <= maxWidth) {
      return candidate
    }
  }
  return ellipsis
}

function measureText(options: {
  text: string
  size: number
  font: FontToken
}): number {
  const { text, size, font } = options
  let total = 0
  for (const character of text) {
    total += advanceRatio({ character, font }) * size
  }
  return total * MEASURE_SAFETY_FACTOR
}

function advanceRatio(options: { character: string; font: FontToken }): number {
  const { character, font } = options
  if (font === 'mono') return MONO_ADVANCE_RATIO

  const explicit = UI_ADVANCE_RATIOS[character]
  if (explicit !== undefined) return explicit
  if (character >= '0' && character <= '9') return UI_DIGIT_RATIO
  if (character >= 'A' && character <= 'Z') return UI_UPPERCASE_RATIO
  return UI_DEFAULT_RATIO
}

function ariaLabel(options: {
  name: string
  owner?: string | null
  stars: number
  forks: number
  language?: { name: string; color: string | null } | null
}): string {
  const { name, owner, stars, forks, language } = options
  const repo = owner ? `${owner}/${name}` : name
  const parts = [`${formatNumber(stars)} stars`, `${formatNumber(forks)} forks`]
  if (language) parts.push(language.name)
  return `${repo}: ${parts.join(', ')}`
}

function isSameOwner(options: {
  owner?: string | null
  login: string
}): boolean {
  const { owner, login } = options
  if (!owner || !login) return false
  return owner.toLowerCase() === login.toLowerCase()
}

function cleanText(text?: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
