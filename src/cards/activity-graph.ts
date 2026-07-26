import type { ContributionDay } from '../fetch/github.ts'
import type { ProfileData } from '../index.ts'
import {
  CARD_PADDING_X,
  CARD_WIDTH,
  COLORS,
  FONTS,
  FONT_SIZE,
  cardFrame,
  escapeXml,
  formatNumber,
  separator,
  svgText,
} from '../theme.ts'

const CARD_HEIGHT = 206
const DEGRADED_CARD_HEIGHT = 104

const WINDOW_DAYS = 31
const SUMMARY_BASELINE_Y = 64
const PLOT_TOP_Y = 84
const PLOT_BOTTOM_Y = 168
const AXIS_BASELINE_Y = 186

const PEAK_HEADROOM = 1.15
const GRID_PITCH_DAYS = 7
const GRID_OPACITY = 0.1
const AREA_TOP_OPACITY = 0.38
const LINE_WIDTH = 2
const PEAK_STEM_OPACITY = 0.2
const PEAK_RULE_OPACITY = 0.35
const TODAY_DOT_RADIUS = 3.5
const TODAY_HALO_RADIUS = 9
const PULSE_DURATION = '2.6s'
const SMOOTHING = 0.72

const AREA_GRADIENT_ID = 'activityGraphArea'

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

type Point = {
  date: string
  count: number
  x: number
  y: number
}

type ActivityGraphModel = {
  points: Point[]
  total: number
  dailyAverage: number
  peak: Point
  today: Point
  startDate: string
  endDate: string
}

export function renderActivityGraph(data: ProfileData): string {
  const days = data.github?.dailyCounts ?? []
  if (days.length < 2) return renderDegraded()

  const model = buildModel({ days })
  const innerWidth = CARD_WIDTH.FULL - CARD_PADDING_X * 2

  const body = [
    renderSummary(model),
    renderGrid({ points: model.points }),
    renderArea({ points: model.points }),
    renderLine({ points: model.points }),
    renderPeakAnnotation({ peak: model.peak, innerWidth }),
    separator({ y: PLOT_BOTTOM_Y, width: innerWidth }),
    renderTodayDot({ today: model.today }),
    renderAxis({ model, innerWidth }),
  ].join('\n')

  return cardFrame({
    width: CARD_WIDTH.FULL,
    height: CARD_HEIGHT,
    title: 'activity graph',
    meta: `${model.points.length}d window`,
    defs: renderAreaGradient(),
    body,
    ariaLabel: `Contribution activity over the last ${model.points.length} days: ${formatNumber(model.total)} contributions, peaking at ${formatNumber(model.peak.count)} on ${formatShortDate(model.peak.date)}`,
  })
}

function renderDegraded(): string {
  const body = [
    svgText({
      content: 'No data',
      x: CARD_PADDING_X,
      y: SUMMARY_BASELINE_Y,
      fill: 'value',
      size: FONT_SIZE.value,
      weight: 600,
    }),
    svgText({
      content:
        'The GitHub contribution calendar failed to fetch on the last run.',
      x: CARD_PADDING_X,
      y: SUMMARY_BASELINE_Y + 22,
      size: FONT_SIZE.summary,
    }),
  ].join('\n')

  return cardFrame({
    width: CARD_WIDTH.FULL,
    height: DEGRADED_CARD_HEIGHT,
    title: 'activity graph',
    body,
    ariaLabel: 'Contribution activity: no data',
  })
}

function renderAreaGradient(): string {
  return [
    `<linearGradient id="${AREA_GRADIENT_ID}" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${COLORS.accent}" stop-opacity="${AREA_TOP_OPACITY}" />`,
    `<stop offset="1" stop-color="${COLORS.accent}" stop-opacity="0" />`,
    '</linearGradient>',
  ].join('')
}

function renderSummary(model: ActivityGraphModel): string {
  const left = [
    `<tspan font-family="${FONTS.mono}" font-size="${FONT_SIZE.value}" font-weight="600" fill="${COLORS.value}">${escapeXml(formatNumber(model.total))}</tspan>`,
    `<tspan> contributions over ${model.points.length} days</tspan>`,
  ].join('')

  const right = [
    `<tspan>avg </tspan>`,
    `<tspan fill="${COLORS.accentAlt}" font-weight="600">${escapeXml(formatNumber(model.dailyAverage))}</tspan>`,
    `<tspan>/day</tspan>`,
    `<tspan dx="10" opacity="0.5">·</tspan>`,
    `<tspan dx="10">today </tspan>`,
    `<tspan fill="${COLORS.healthy}" font-weight="600">${escapeXml(formatNumber(model.today.count))}</tspan>`,
  ].join('')

  return [
    svgText({
      content: left,
      x: CARD_PADDING_X,
      y: SUMMARY_BASELINE_Y,
      size: FONT_SIZE.summary,
      raw: true,
    }),
    svgText({
      content: right,
      x: CARD_WIDTH.FULL - CARD_PADDING_X,
      y: SUMMARY_BASELINE_Y - 1,
      size: FONT_SIZE.body,
      font: 'mono',
      anchor: 'end',
      raw: true,
    }),
  ].join('\n')
}

function renderGrid(options: { points: Point[] }): string {
  const { points } = options
  const lines: string[] = []

  for (
    let index = points.length - 1 - GRID_PITCH_DAYS;
    index > 0;
    index -= GRID_PITCH_DAYS
  ) {
    const x = points[index]?.x
    if (x === undefined) continue
    lines.push(
      `<line x1="${x}" y1="${PLOT_TOP_Y}" x2="${x}" y2="${PLOT_BOTTOM_Y}" stroke="${COLORS.body}" stroke-width="1" opacity="${GRID_OPACITY}" />`,
    )
  }

  return lines.join('\n')
}

function renderArea(options: { points: Point[] }): string {
  const { points } = options
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return ''

  const path = [
    smoothPath(points),
    `L ${last.x} ${PLOT_BOTTOM_Y}`,
    `L ${first.x} ${PLOT_BOTTOM_Y}`,
    'Z',
  ].join(' ')

  return `<path d="${path}" fill="url(#${AREA_GRADIENT_ID})" />`
}

function renderLine(options: { points: Point[] }): string {
  return `<path d="${smoothPath(options.points)}" fill="none" stroke="${COLORS.accentAlt}" stroke-width="${LINE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" />`
}

function renderPeakAnnotation(options: {
  peak: Point
  innerWidth: number
}): string {
  const { peak, innerWidth } = options
  const label = `peak ${formatNumber(peak.count)} · ${formatShortDate(peak.date)}`

  return [
    `<line x1="${CARD_PADDING_X}" y1="${peak.y}" x2="${CARD_PADDING_X + innerWidth}" y2="${peak.y}" stroke="${COLORS.accent}" stroke-width="1" stroke-dasharray="3 5" opacity="${PEAK_RULE_OPACITY}" />`,
    `<line x1="${peak.x}" y1="${peak.y}" x2="${peak.x}" y2="${PLOT_BOTTOM_Y}" stroke="${COLORS.accentAlt}" stroke-width="1" opacity="${PEAK_STEM_OPACITY}" />`,
    `<circle cx="${peak.x}" cy="${peak.y}" r="2.5" fill="${COLORS.accent}" />`,
    svgText({
      content: label,
      x: CARD_WIDTH.FULL - CARD_PADDING_X,
      y: peak.y - 7,
      size: FONT_SIZE.label,
      font: 'mono',
      fill: 'accent',
      anchor: 'end',
      opacity: 0.8,
    }),
  ].join('\n')
}

function renderTodayDot(options: { today: Point }): string {
  const { today } = options
  const ringRadius = `<animate attributeName="r" values="${TODAY_DOT_RADIUS};${TODAY_HALO_RADIUS}" dur="${PULSE_DURATION}" repeatCount="indefinite" />`
  const ringFade = `<animate attributeName="opacity" values="0.5;0" dur="${PULSE_DURATION}" repeatCount="indefinite" />`

  return [
    `<circle cx="${today.x}" cy="${today.y}" r="${TODAY_DOT_RADIUS}" fill="none" stroke="${COLORS.accentAlt}" stroke-width="1">${ringRadius}${ringFade}</circle>`,
    `<circle cx="${today.x}" cy="${today.y}" r="${TODAY_DOT_RADIUS}" fill="${COLORS.background}" stroke="${COLORS.accentAlt}" stroke-width="2" />`,
  ].join('\n')
}

function renderAxis(options: {
  model: ActivityGraphModel
  innerWidth: number
}): string {
  const { model, innerWidth } = options

  return [
    svgText({
      content: formatShortDate(model.startDate),
      x: CARD_PADDING_X,
      y: AXIS_BASELINE_Y,
      size: FONT_SIZE.label,
      font: 'mono',
      opacity: 0.6,
    }),
    svgText({
      content: 'daily contributions',
      x: CARD_PADDING_X + innerWidth / 2,
      y: AXIS_BASELINE_Y,
      size: FONT_SIZE.label,
      anchor: 'middle',
      opacity: 0.45,
    }),
    svgText({
      content: `${formatShortDate(model.endDate)} · today`,
      x: CARD_WIDTH.FULL - CARD_PADDING_X,
      y: AXIS_BASELINE_Y,
      size: FONT_SIZE.label,
      font: 'mono',
      anchor: 'end',
      opacity: 0.6,
    }),
  ].join('\n')
}

function buildModel(options: { days: ContributionDay[] }): ActivityGraphModel {
  const window = options.days.slice(-WINDOW_DAYS)
  const counts = window.map((day) => day.count)
  const total = counts.reduce((sum, count) => sum + count, 0)
  const highest = Math.max(...counts)
  const scaleMax = Math.max(1, highest * PEAK_HEADROOM)

  const innerWidth = CARD_WIDTH.FULL - CARD_PADDING_X * 2
  const pitch = innerWidth / Math.max(1, window.length - 1)
  const plotHeight = PLOT_BOTTOM_Y - PLOT_TOP_Y

  const points: Point[] = window.map((day, index) => ({
    date: day.date,
    count: day.count,
    x: round(CARD_PADDING_X + index * pitch),
    y: round(PLOT_BOTTOM_Y - (day.count / scaleMax) * plotHeight),
  }))

  const peak =
    points.find((point) => point.count === highest) ?? (points[0] as Point)
  const today = points[points.length - 1] as Point

  return {
    points,
    total,
    dailyAverage: Math.round(total / points.length),
    peak,
    today,
    startDate: window[0]?.date ?? today.date,
    endDate: today.date,
  }
}

function smoothPath(points: Point[]): string {
  const first = points[0]
  if (!first) return ''

  const segments = [`M ${first.x} ${first.y}`]

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index]
    const start = points[index]
    const end = points[index + 1]
    const next = points[index + 2] ?? points[index + 1]
    if (!previous || !start || !end || !next) continue

    const control1 = {
      x: round(start.x + ((end.x - previous.x) / 6) * SMOOTHING),
      y: clampToPlot(start.y + ((end.y - previous.y) / 6) * SMOOTHING),
    }
    const control2 = {
      x: round(end.x - ((next.x - start.x) / 6) * SMOOTHING),
      y: clampToPlot(end.y - ((next.y - start.y) / 6) * SMOOTHING),
    }

    segments.push(
      `C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`,
    )
  }

  return segments.join(' ')
}

function clampToPlot(y: number): number {
  return round(Math.min(PLOT_BOTTOM_Y, Math.max(PLOT_TOP_Y, y)))
}

function formatShortDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  const month = MONTH_LABELS[parsed.getUTCMonth()] ?? ''
  return `${month} ${parsed.getUTCDate()}`
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
