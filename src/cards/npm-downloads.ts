import type { ProfileData } from '../index.ts'
import type { NpmData, NpmPackageDownloads } from '../fetch/npm.ts'
import {
  BODY_START_Y,
  CARD_PADDING_X,
  CARD_WIDTH,
  COLORS,
  FONT_SIZE,
  formatNumber,
  separator,
  svgText,
  truncate,
  cardFrame,
} from '../theme.ts'

const WIDTH = CARD_WIDTH.FULL
const CONTENT_WIDTH = WIDTH - CARD_PADDING_X * 2
const RIGHT_EDGE = WIDTH - CARD_PADDING_X

const HERO_BASELINE_Y = 78
const HERO_SUFFIX_GAP = 12
const VELOCITY_BASELINE_Y = 66
const PROJECTION_BASELINE_Y = 84
const HEADER_SEPARATOR_Y = 104

const BAR_X = 178
const MAX_BAR_WIDTH = 580
const MIN_BAR_WIDTH = 26
const BAR_HEIGHT = 9
const BAR_RADIUS = 4.5
const ROW_HEIGHT = 27
const ROWS_START_Y = 118
const ROW_LABEL_OFFSET_Y = 8
const ROW_SEPARATOR_OFFSET_Y = 18
const FOOTER_OFFSET_Y = 34
const BOTTOM_PADDING = 24

const MAX_ROWS = 8
/** Keeps the longest name clear of the bar track that starts at `BAR_X`. */
const MAX_NAME_LENGTH = 20
/** Compresses the long tail so four-digit packages stay readable next to spindb. */
const BAR_SCALE_EXPONENT = 0.45
const TRACK_OPACITY = 0.08
const BAR_ANIMATION_DURATION_SECONDS = 0.9
const BAR_ANIMATION_STAGGER_SECONDS = 0.07
/** Keeps every bar at its final width when a rasterizer samples the SVG at t=0. */
const BAR_ANIMATION_DELAY_SECONDS = 0.15
const MONO_ADVANCE_RATIO = 0.6

const GRADIENT_ID = 'npm-bar-gradient'

export function renderNpmDownloads(data: ProfileData): string {
  if (!data.npm || data.npm.packages.length === 0) {
    return renderUnavailable()
  }
  return renderCard(data.npm)
}

function renderCard(npm: NpmData): string {
  const ranked = [...npm.packages].sort(
    (left, right) => right.allTime - left.allTime,
  )
  const visible = ranked.slice(0, MAX_ROWS)
  const hidden = ranked.slice(MAX_ROWS)
  const maxAllTime = visible[0]?.allTime ?? 0

  const heroValue = formatNumber(npm.totalAllTime)
  const heroSuffixX =
    CARD_PADDING_X +
    monoWidth({ text: heroValue, size: FONT_SIZE.hero }) +
    HERO_SUFFIX_GAP

  const body: string[] = [
    svgText({
      content: heroValue,
      x: CARD_PADDING_X,
      y: HERO_BASELINE_Y,
      fill: 'value',
      size: FONT_SIZE.hero,
      font: 'mono',
      weight: 600,
      letterSpacing: -0.5,
    }),
    svgText({
      content: 'downloads and counting',
      x: heroSuffixX,
      y: HERO_BASELINE_Y,
      size: FONT_SIZE.body,
      letterSpacing: 0.3,
    }),
    svgText({
      content: `${formatNumber(npm.totalDailyAverage)} / day`,
      x: RIGHT_EDGE,
      y: VELOCITY_BASELINE_Y,
      fill: 'accentAlt',
      size: FONT_SIZE.body,
      font: 'mono',
      anchor: 'end',
    }),
    svgText({
      content: `${formatNumber(npm.totalProjectedYear, { compact: true })} projected / yr`,
      x: RIGHT_EDGE,
      y: PROJECTION_BASELINE_Y,
      size: FONT_SIZE.label,
      font: 'mono',
      anchor: 'end',
      opacity: 0.8,
    }),
    separator({ y: HEADER_SEPARATOR_Y, width: CONTENT_WIDTH }),
  ]

  visible.forEach((entry, index) => {
    body.push(
      renderRow({
        entry,
        index,
        maxAllTime,
        isLastRow: index === visible.length - 1 && hidden.length === 0,
      }),
    )
  })

  const lastRowTop = ROWS_START_Y + (visible.length - 1) * ROW_HEIGHT
  let height = lastRowTop + BAR_HEIGHT + BOTTOM_PADDING

  if (hidden.length > 0) {
    const hiddenTotal = hidden.reduce(
      (total, entry) => total + entry.allTime,
      0,
    )
    const footerY = lastRowTop + FOOTER_OFFSET_Y
    body.push(
      svgText({
        content: `+${hidden.length} more package${hidden.length === 1 ? '' : 's'}`,
        x: CARD_PADDING_X,
        y: footerY,
        size: FONT_SIZE.label,
        font: 'mono',
        opacity: 0.75,
      }),
      svgText({
        content: `${formatNumber(hiddenTotal)} downloads`,
        x: RIGHT_EDGE,
        y: footerY,
        size: FONT_SIZE.label,
        font: 'mono',
        anchor: 'end',
        opacity: 0.75,
      }),
    )
    height = footerY + BOTTOM_PADDING
  }

  return cardFrame({
    width: WIDTH,
    height,
    title: 'npm downloads',
    meta: `${ranked.length} packages`,
    ariaLabel: `npm downloads: ${heroValue} all-time across ${ranked.length} packages`,
    defs: renderGradient(),
    body: body.join('\n'),
  })
}

function renderRow(options: {
  entry: NpmPackageDownloads
  index: number
  maxAllTime: number
  isLastRow: boolean
}): string {
  const { entry, index, maxAllTime, isLastRow } = options
  const rowTop = ROWS_START_Y + index * ROW_HEIGHT
  const labelY = rowTop + ROW_LABEL_OFFSET_Y
  const width = barWidth({ value: entry.allTime, max: maxAllTime })

  const parts = [
    svgText({
      content: truncate(entry.name, { maxLength: MAX_NAME_LENGTH }),
      x: CARD_PADDING_X,
      y: labelY,
      fill: index === 0 ? 'accent' : 'body',
      size: FONT_SIZE.body,
      font: 'mono',
      weight: index === 0 ? 600 : undefined,
    }),
    `<rect x="${BAR_X}" y="${rowTop}" width="${MAX_BAR_WIDTH}" height="${BAR_HEIGHT}" rx="${BAR_RADIUS}" fill="${COLORS.body}" opacity="${TRACK_OPACITY}" />`,
    `<rect x="${BAR_X}" y="${rowTop}" width="${width}" height="${BAR_HEIGHT}" rx="${BAR_RADIUS}" fill="url(#${GRADIENT_ID})">` +
      `<animate attributeName="width" from="0" to="${width}" dur="${BAR_ANIMATION_DURATION_SECONDS}s" begin="${(BAR_ANIMATION_DELAY_SECONDS + index * BAR_ANIMATION_STAGGER_SECONDS).toFixed(2)}s" fill="freeze" />` +
      '</rect>',
    svgText({
      content: formatNumber(entry.allTime),
      x: RIGHT_EDGE,
      y: labelY,
      fill: 'value',
      size: FONT_SIZE.body,
      font: 'mono',
      anchor: 'end',
    }),
  ]

  if (!isLastRow) {
    parts.push(
      separator({ y: rowTop + ROW_SEPARATOR_OFFSET_Y, width: CONTENT_WIDTH }),
    )
  }

  return parts.join('\n')
}

function barWidth(options: { value: number; max: number }): number {
  const { value, max } = options
  if (max <= 0) return MIN_BAR_WIDTH

  const ratio = Math.max(0, value / max) ** BAR_SCALE_EXPONENT
  const scaled = MIN_BAR_WIDTH + ratio * (MAX_BAR_WIDTH - MIN_BAR_WIDTH)

  return Math.round(Math.min(MAX_BAR_WIDTH, scaled) * 10) / 10
}

function renderGradient(): string {
  return (
    `<linearGradient id="${GRADIENT_ID}" gradientUnits="userSpaceOnUse" x1="${BAR_X}" y1="0" x2="${BAR_X + MAX_BAR_WIDTH}" y2="0">` +
    `<stop offset="0" stop-color="${COLORS.accent}" />` +
    `<stop offset="1" stop-color="${COLORS.accentAlt}" />` +
    '</linearGradient>'
  )
}

function monoWidth(options: { text: string; size: number }): number {
  const { text, size } = options
  return Math.round(text.length * size * MONO_ADVANCE_RATIO)
}

function renderUnavailable(): string {
  return cardFrame({
    width: WIDTH,
    height: 96,
    title: 'npm downloads',
    ariaLabel: 'npm downloads: data unavailable',
    body: svgText({
      content: 'registry unreachable - totals return on the next run',
      x: CARD_PADDING_X,
      y: BODY_START_Y + 8,
      size: FONT_SIZE.body,
      font: 'mono',
      opacity: 0.8,
    }),
  })
}
