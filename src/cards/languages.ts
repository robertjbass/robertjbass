import type { LanguageUsage } from '../fetch/github.ts'
import type { ProfileData } from '../index.ts'
import {
  BODY_START_Y,
  CARD_PADDING_X,
  CARD_WIDTH,
  COLORS,
  FONT_SIZE,
  PROMPT_GLYPH,
  PROMPT_LABEL_OFFSET_X,
  cardFrame,
  formatNumber,
  resolveColor,
  separator,
  svgText,
  truncate,
} from '../theme.ts'

const CARD_TITLE = 'top languages'
const EMPTY_NOTE = 'language breakdown returns on the next run'

const WIDTH = CARD_WIDTH.HALF
const CONTENT_WIDTH = WIDTH - CARD_PADDING_X * 2

const BAR_Y = 54
const BAR_HEIGHT = 10
const BAR_RADIUS = 5
const TRACK_OPACITY = 0.1
const MIN_SEGMENT_WIDTH = 2
const BAR_CLIP_ID = 'languages-bar-clip'
const REVEAL_DURATION_SECONDS = 0.9
/** Keeps the bar at full width when a rasterizer samples the SVG at t=0. */
const REVEAL_DELAY_SECONDS = 0.15

const LEGEND_START_Y = 86
const LEGEND_ROW_HEIGHT = 20
const LEGEND_COLUMNS = 2
const LEGEND_COLUMN_GAP = 18
const LEGEND_DOT_RADIUS = 3.5
const LEGEND_DOT_OFFSET_X = 4
const LEGEND_DOT_OFFSET_Y = 4
const LEGEND_NAME_OFFSET_X = 15
const LEGEND_NAME_MAX_LENGTH = 15
const LEGEND_ENTRIES = 10

const FOOTER_RULE_OFFSET_Y = 13
const FOOTER_TEXT_OFFSET_Y = 21
const BOTTOM_PADDING_Y = 20

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const
const BYTE_STEP = 1000

export function renderLanguages(data: ProfileData): string {
  const languages = data.github?.languages ?? []
  if (languages.length === 0) return renderUnavailable()
  return renderCard(languages)
}

function renderCard(languages: LanguageUsage[]): string {
  const ranked = [...languages].sort((left, right) => right.share - left.share)
  const visible = ranked.slice(0, LEGEND_ENTRIES)
  const overflow = ranked.length - visible.length
  const totalBytes = ranked.reduce((total, entry) => total + entry.bytes, 0)

  const tailShare = ranked
    .slice(LEGEND_ENTRIES)
    .reduce((total, entry) => total + entry.share, 0)

  const rowCount = Math.ceil(visible.length / LEGEND_COLUMNS)
  const lastRowBaselineY = LEGEND_START_Y + (rowCount - 1) * LEGEND_ROW_HEIGHT
  const footerRuleY = lastRowBaselineY + FOOTER_RULE_OFFSET_Y
  const footerBaselineY = footerRuleY + FOOTER_TEXT_OFFSET_Y

  const body = [
    renderBar({ visible, tailShare }),
    ...renderLegend(visible),
    separator({ y: footerRuleY, width: CONTENT_WIDTH }),
    renderFooter({ baselineY: footerBaselineY, overflow, totalBytes }),
  ].join('\n')

  return cardFrame({
    width: WIDTH,
    height: footerBaselineY + BOTTOM_PADDING_Y,
    title: CARD_TITLE,
    meta: `${ranked.length} tracked`,
    defs: renderBarClip(),
    body,
    ariaLabel: `${CARD_TITLE}: ${visible
      .slice(0, 3)
      .map((entry) => `${entry.name} ${formatShare(entry.share)}`)
      .join(', ')} across ${ranked.length} languages`,
  })
}

function renderBar(options: {
  visible: LanguageUsage[]
  tailShare: number
}): string {
  const { visible, tailShare } = options
  const shares = visible.map((entry) => entry.share)
  const colors = visible.map(segmentColor)

  if (tailShare > 0) {
    shares.push(tailShare)
    colors.push(resolveColor('body'))
  }

  const widths = segmentWidths({ shares, width: CONTENT_WIDTH })
  const segments: string[] = [
    `<rect x="${CARD_PADDING_X}" y="${BAR_Y}" width="${CONTENT_WIDTH}" height="${BAR_HEIGHT}" rx="${BAR_RADIUS}" fill="${COLORS.body}" opacity="${TRACK_OPACITY}" />`,
    `<g clip-path="url(#${BAR_CLIP_ID})">`,
  ]

  let offsetX = CARD_PADDING_X
  widths.forEach((width, index) => {
    if (width <= 0) return
    segments.push(
      `<rect x="${round(offsetX)}" y="${BAR_Y}" width="${width}" height="${BAR_HEIGHT}" fill="${colors[index]}" />`,
    )
    offsetX += width
  })

  segments.push('</g>')
  return segments.join('\n')
}

function renderBarClip(): string {
  return (
    `<clipPath id="${BAR_CLIP_ID}">` +
    `<rect x="${CARD_PADDING_X}" y="${BAR_Y}" width="${CONTENT_WIDTH}" height="${BAR_HEIGHT}" rx="${BAR_RADIUS}">` +
    `<animate attributeName="width" from="0" to="${CONTENT_WIDTH}" dur="${REVEAL_DURATION_SECONDS}s" begin="${REVEAL_DELAY_SECONDS}s" fill="freeze" />` +
    '</rect>' +
    '</clipPath>'
  )
}

function renderLegend(languages: LanguageUsage[]): string[] {
  const columnWidth =
    (CONTENT_WIDTH - LEGEND_COLUMN_GAP * (LEGEND_COLUMNS - 1)) / LEGEND_COLUMNS
  const rowCount = Math.ceil(languages.length / LEGEND_COLUMNS)

  return languages.flatMap((entry, index) => {
    const column = Math.floor(index / rowCount)
    const row = index % rowCount
    const columnX = CARD_PADDING_X + column * (columnWidth + LEGEND_COLUMN_GAP)
    const baselineY = LEGEND_START_Y + row * LEGEND_ROW_HEIGHT

    return [
      `<circle cx="${columnX + LEGEND_DOT_OFFSET_X}" cy="${baselineY - LEGEND_DOT_OFFSET_Y}" r="${LEGEND_DOT_RADIUS}" fill="${segmentColor(entry)}" />`,
      svgText({
        content: truncate(entry.name, { maxLength: LEGEND_NAME_MAX_LENGTH }),
        x: columnX + LEGEND_NAME_OFFSET_X,
        y: baselineY,
        fill: index === 0 ? 'value' : 'body',
        size: FONT_SIZE.body,
        weight: index === 0 ? 600 : undefined,
      }),
      svgText({
        content: formatShare(entry.share),
        x: columnX + columnWidth,
        y: baselineY,
        fill: index === 0 ? 'accent' : 'value',
        size: FONT_SIZE.body,
        font: 'mono',
        anchor: 'end',
        opacity: index === 0 ? undefined : 0.85,
      }),
    ]
  })
}

function renderFooter(options: {
  baselineY: number
  overflow: number
  totalBytes: number
}): string {
  const { baselineY, overflow, totalBytes } = options
  const label =
    overflow > 0
      ? `+${formatNumber(overflow)} more languages`
      : 'full breakdown shown'

  return [
    svgText({
      content: PROMPT_GLYPH,
      x: CARD_PADDING_X,
      y: baselineY,
      fill: 'accentAlt',
      size: FONT_SIZE.label,
      font: 'mono',
    }),
    svgText({
      content: label,
      x: CARD_PADDING_X + PROMPT_LABEL_OFFSET_X,
      y: baselineY,
      size: FONT_SIZE.label,
      opacity: 0.8,
    }),
    svgText({
      content: `${formatBytes(totalBytes)} indexed`,
      x: WIDTH - CARD_PADDING_X,
      y: baselineY,
      size: FONT_SIZE.label,
      font: 'mono',
      anchor: 'end',
      opacity: 0.75,
    }),
  ].join('\n')
}

function segmentWidths(options: { shares: number[]; width: number }): number[] {
  const { shares, width } = options
  const total = shares.reduce((sum, share) => sum + Math.max(0, share), 0)
  if (total <= 0) return shares.map(() => 0)

  const raw = shares.map((share) => (Math.max(0, share) / total) * width)
  const floorCount = raw.filter((value) => value < MIN_SEGMENT_WIDTH).length
  const surplusTotal = raw.reduce(
    (sum, value) => sum + Math.max(0, value - MIN_SEGMENT_WIDTH),
    0,
  )
  const deficit = raw.reduce(
    (sum, value) => sum + Math.max(0, MIN_SEGMENT_WIDTH - value),
    0,
  )

  const scale =
    floorCount === 0 || surplusTotal <= deficit
      ? 1
      : (surplusTotal - deficit) / surplusTotal

  const adjusted = raw.map((value) =>
    value < MIN_SEGMENT_WIDTH
      ? MIN_SEGMENT_WIDTH
      : MIN_SEGMENT_WIDTH + (value - MIN_SEGMENT_WIDTH) * scale,
  )

  const rounded = adjusted.map(round)
  const drift = width - rounded.reduce((sum, value) => sum + value, 0)
  const widestIndex = rounded.indexOf(Math.max(...rounded))
  const widest = rounded[widestIndex]
  if (widest !== undefined) {
    rounded[widestIndex] = round(widest + drift)
  }

  return rounded
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function segmentColor(language: LanguageUsage): string {
  return language.color ?? resolveColor('body')
}

function formatShare(share: number): string {
  const percent = share * 100
  if (percent > 0 && percent < 0.01) return '<0.01%'
  return `${percent.toFixed(percent < 1 ? 2 : 1)}%`
}

function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes)
  let unitIndex = 0

  while (value >= BYTE_STEP && unitIndex < BYTE_UNITS.length - 1) {
    value /= BYTE_STEP
    unitIndex += 1
  }

  const decimals = unitIndex === 0 || value >= 100 ? 0 : 1
  return `${value.toFixed(decimals)} ${BYTE_UNITS[unitIndex]}`
}

function renderUnavailable(): string {
  return cardFrame({
    width: WIDTH,
    height: 96,
    title: CARD_TITLE,
    ariaLabel: `${CARD_TITLE}: data unavailable`,
    body: svgText({
      content: EMPTY_NOTE,
      x: CARD_PADDING_X,
      y: BODY_START_Y + 8,
      size: FONT_SIZE.body,
      font: 'mono',
      opacity: 0.8,
    }),
  })
}
