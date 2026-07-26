import type { ProfileData } from '../index.ts'
import {
  CARD_PADDING_X,
  CARD_WIDTH,
  COLORS,
  FONT_SIZE,
  TITLE_BASELINE_Y,
  cardFrame,
  formatNumber,
  separator,
  svgText,
  type ColorToken,
} from '../theme.ts'

const CARD_TITLE = 'stats'
const ROWS_START_Y = TITLE_BASELINE_Y + 12
const ROW_HEIGHT = 36
const ROW_HEIGHT_WITH_NOTE = 50
const ROW_VALUE_BASELINE = 22
const ROW_NOTE_BASELINE = 38
const CARD_BOTTOM_PADDING = 8
const MONO_WIDTH_RATIO = 0.6
const LIVE_DOT_RADIUS = 3.5
const LIVE_DOT_GAP = 11
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

type StatRow = {
  label: string
  value: string
  note?: string
  valueColor?: ColorToken
  live?: boolean
}

export function renderStats(data: ProfileData): string {
  const github = data.github
  if (!github) return renderUnavailable()

  const rows = buildRows({ github })
  const contentWidth = CARD_WIDTH.HALF - CARD_PADDING_X * 2
  const body: string[] = []

  let rowTop = ROWS_START_Y

  for (const [index, row] of rows.entries()) {
    if (index > 0) body.push(separator({ y: rowTop, width: contentWidth }))
    body.push(renderRow({ row, top: rowTop, width: CARD_WIDTH.HALF }))
    rowTop += row.note ? ROW_HEIGHT_WITH_NOTE : ROW_HEIGHT
  }

  return cardFrame({
    width: CARD_WIDTH.HALF,
    height: rowTop + CARD_BOTTOM_PADDING,
    title: CARD_TITLE,
    meta: `@${github.login}`,
    ariaLabel: buildAriaLabel({ rows }),
    body: body.join('\n'),
  })
}

function buildRows(options: {
  github: NonNullable<ProfileData['github']>
}): StatRow[] {
  const { github } = options

  return [
    {
      label: 'contributions',
      value: formatNumber(github.totalContributionsPastYear, {
        compact: true,
      }),
      note: 'past year · incl. private work',
    },
    {
      label: 'repositories',
      value: formatNumber(github.totalRepoCount),
      note: repoNote({ github }),
    },
    {
      label: 'followers',
      value: formatNumber(github.followers),
    },
    {
      label: 'current streak',
      value: `${formatNumber(github.currentStreakDays)} days`,
      note: streakNote({ startDate: github.streakStartDate }),
      valueColor: 'healthy',
      live: github.currentStreakDays > 0,
    },
  ]
}

function renderRow(options: {
  row: StatRow
  top: number
  width: number
}): string {
  const { row, top, width } = options
  const baseline = top + ROW_VALUE_BASELINE
  const valueRight = width - CARD_PADDING_X
  const parts = [
    svgText({
      content: row.label,
      x: CARD_PADDING_X,
      y: baseline,
      size: FONT_SIZE.body,
      letterSpacing: 0.2,
    }),
    svgText({
      content: row.value,
      x: valueRight,
      y: baseline,
      fill: row.valueColor ?? 'value',
      size: FONT_SIZE.value,
      font: 'mono',
      weight: 600,
      anchor: 'end',
    }),
  ]

  if (row.live) {
    const dotX =
      valueRight - monoTextWidth(row.value, FONT_SIZE.value) - LIVE_DOT_GAP
    parts.push(
      renderLiveDot({ x: dotX, y: baseline - FONT_SIZE.value / 2 + 2 }),
    )
  }

  if (row.note) {
    parts.push(
      svgText({
        content: row.note,
        x: CARD_PADDING_X,
        y: top + ROW_NOTE_BASELINE,
        size: FONT_SIZE.label,
        font: 'mono',
        opacity: 0.7,
      }),
    )
  }

  return parts.join('\n')
}

function renderLiveDot(options: { x: number; y: number }): string {
  const { x, y } = options
  return [
    `<circle cx="${round(x)}" cy="${round(y)}" r="${LIVE_DOT_RADIUS}" fill="${COLORS.healthy}">`,
    '<animate attributeName="opacity" values="1;0.3;1" dur="2.8s" repeatCount="indefinite" />',
    '</circle>',
  ].join('')
}

function repoNote(options: {
  github: NonNullable<ProfileData['github']>
}): string {
  const { github } = options
  const privateCount = Math.max(github.repoCount - github.publicRepoCount, 0)
  return [
    `${formatNumber(github.publicRepoCount)} public`,
    `${formatNumber(privateCount)} private`,
    `${formatNumber(github.layerbaseRepoCount)} org`,
  ].join(' · ')
}

function streakNote(options: { startDate: string | null }): string | undefined {
  const { startDate } = options
  const formatted = formatIsoDate(startDate)
  return formatted ? `unbroken since ${formatted}` : undefined
}

function formatIsoDate(value: string | null): string | null {
  if (!value) return null
  const [year, month, day] = value.split('-')
  const monthLabel = MONTH_LABELS[Number(month) - 1]
  if (!year || !monthLabel || !day) return null
  return `${monthLabel} ${Number(day)}, ${year}`
}

function monoTextWidth(text: string, size: number): number {
  return text.length * size * MONO_WIDTH_RATIO
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function buildAriaLabel(options: { rows: StatRow[] }): string {
  const { rows } = options
  const summary = rows.map((row) => `${row.label} ${row.value}`).join(', ')
  return `GitHub stats: ${summary}`
}

function renderUnavailable(): string {
  return cardFrame({
    width: CARD_WIDTH.HALF,
    height: ROWS_START_Y + ROW_HEIGHT + CARD_BOTTOM_PADDING,
    title: CARD_TITLE,
    ariaLabel: 'GitHub stats unavailable',
    body: svgText({
      content: 'github data unavailable',
      x: CARD_PADDING_X,
      y: ROWS_START_Y + ROW_VALUE_BASELINE,
      size: FONT_SIZE.body,
      font: 'mono',
      opacity: 0.8,
    }),
  })
}
