import {
  BODY_START_Y,
  CARD_PADDING_X,
  CARD_WIDTH,
  FONT_SIZE,
  SEPARATOR_OPACITY,
  cardFrame,
  formatNumber,
  resolveColor,
  separator,
  svgText,
  type ColorToken,
} from '../theme.ts'
import type { ProfileData } from '../index.ts'

const CARD_TITLE = 'upcoming milestones'
const CARD_WIDTH_PX = CARD_WIDTH.HALF
const CONTENT_WIDTH = CARD_WIDTH_PX - CARD_PADDING_X * 2
const ROW_STRIDE = 58
const BAR_OFFSET_Y = 10
const BAR_HEIGHT = 4
const BAR_RADIUS = 2
const TRACK_OPACITY = 0.16
const DETAIL_OFFSET_Y = 30
const SEPARATOR_OFFSET_Y = 43
const CARD_BOTTOM_PADDING = 22
const MIN_BAR_WIDTH = 2

const STREAK_TARGET_DAYS = 365
const DOWNLOAD_TARGET = 100_000
const REPO_TARGET = 300
const IMMINENT_PROGRESS = 0.8
const MS_PER_DAY = 86_400_000

const MONTH_NAMES = [
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
] as const

type Milestone = {
  label: string
  detail: string
  progressText: string
  progress: number
}

export function renderMilestones(data: ProfileData): string {
  const milestones = buildMilestones(data)

  if (milestones.length === 0) {
    return cardFrame({
      width: CARD_WIDTH_PX,
      height: BODY_START_Y + CARD_BOTTOM_PADDING,
      title: CARD_TITLE,
      ariaLabel: `${CARD_TITLE}: no data available`,
      body: svgText({
        content: 'No milestone data available',
        x: CARD_PADDING_X,
        y: BODY_START_Y,
        size: FONT_SIZE.body,
        font: 'mono',
        opacity: 0.8,
      }),
    })
  }

  const rows = milestones.map((milestone, index) =>
    renderRow({ milestone, index, isLast: index === milestones.length - 1 }),
  )
  const lastRowY = BODY_START_Y + (milestones.length - 1) * ROW_STRIDE
  const height = lastRowY + DETAIL_OFFSET_Y + CARD_BOTTOM_PADDING

  return cardFrame({
    width: CARD_WIDTH_PX,
    height,
    title: CARD_TITLE,
    meta: `${milestones.length} tracked`,
    ariaLabel: ariaLabelFor(milestones),
    body: rows.join('\n'),
  })
}

function ariaLabelFor(milestones: Milestone[]): string {
  const summary = milestones
    .map((milestone) => `${milestone.label} at ${milestone.progressText}`)
    .join('; ')
  return `${CARD_TITLE}: ${summary}`
}

function buildMilestones(data: ProfileData): Milestone[] {
  const today = parseIsoDate(data.generatedAt)
  const candidates = [
    streakMilestone({ github: data.github, today }),
    downloadMilestone({ npm: data.npm, today }),
    repoMilestone({ github: data.github }),
  ]
  return candidates.filter((milestone): milestone is Milestone =>
    Boolean(milestone),
  )
}

function streakMilestone(options: {
  github: ProfileData['github']
  today: Date | null
}): Milestone | null {
  const { github, today } = options
  if (!github || github.currentStreakDays <= 0) return null
  if (github.currentStreakDays >= STREAK_TARGET_DAYS) return null

  const streakStart = github.streakStartDate
    ? parseIsoDate(github.streakStartDate)
    : today
      ? addDays({ date: today, days: 1 - github.currentStreakDays })
      : null

  const detailParts: string[] = []
  if (streakStart) {
    const target = addDays({
      date: streakStart,
      days: STREAK_TARGET_DAYS - 1,
    })
    detailParts.push(formatDate(target))
    if (today) {
      detailParts.push(`${daysBetween({ from: today, to: target })} days away`)
    }
  }
  if (detailParts.length === 0) {
    detailParts.push(
      `${STREAK_TARGET_DAYS - github.currentStreakDays} days to go`,
    )
  }

  return {
    label: `${STREAK_TARGET_DAYS}-day streak`,
    detail: detailParts.join(' · '),
    progressText: `${formatNumber(github.currentStreakDays)} / ${STREAK_TARGET_DAYS}`,
    progress: github.currentStreakDays / STREAK_TARGET_DAYS,
  }
}

function downloadMilestone(options: {
  npm: ProfileData['npm']
  today: Date | null
}): Milestone | null {
  const { npm, today } = options
  if (!npm || npm.totalAllTime >= DOWNLOAD_TARGET) return null

  const velocityPerDay =
    npm.windowDays > 0 ? npm.totalLast90Days / npm.windowDays : 0
  const remaining = DOWNLOAD_TARGET - npm.totalAllTime

  const detailParts: string[] = []
  if (velocityPerDay > 0) {
    const daysOut = Math.ceil(remaining / velocityPerDay)
    if (today) {
      detailParts.push(
        `~${formatMonth(addDays({ date: today, days: daysOut }))}`,
      )
    }
    detailParts.push(`${formatNumber(daysOut)} days`)
    detailParts.push(`${formatNumber(Math.round(velocityPerDay))}/day`)
  } else {
    detailParts.push(`${formatNumber(remaining, { compact: true })} to go`)
    detailParts.push('velocity unavailable')
  }

  return {
    label: `${formatNumber(DOWNLOAD_TARGET, { compact: true })} npm downloads`,
    detail: detailParts.join(' · '),
    progressText: `${formatNumber(npm.totalAllTime, { compact: true })} / ${formatNumber(DOWNLOAD_TARGET, { compact: true })}`,
    progress: npm.totalAllTime / DOWNLOAD_TARGET,
  }
}

function repoMilestone(options: {
  github: ProfileData['github']
}): Milestone | null {
  const { github } = options
  if (!github) return null

  const repoCount = github.totalRepoCount
  if (repoCount >= REPO_TARGET) return null

  const remaining = REPO_TARGET - repoCount

  return {
    label: `${REPO_TARGET} repositories`,
    detail: `${formatNumber(remaining)} to go · ${formatNumber(github.publicRepoCount)} public`,
    progressText: `${formatNumber(repoCount)} / ${REPO_TARGET}`,
    progress: repoCount / REPO_TARGET,
  }
}

function renderRow(options: {
  milestone: Milestone
  index: number
  isLast: boolean
}): string {
  const { milestone, index, isLast } = options
  const y = BODY_START_Y + index * ROW_STRIDE
  const progress = clamp({ value: milestone.progress, min: 0, max: 1 })
  const barColor: ColorToken =
    progress >= IMMINENT_PROGRESS ? 'healthy' : 'accentAlt'
  const filledWidth =
    progress > 0
      ? Math.max(MIN_BAR_WIDTH, Math.round(CONTENT_WIDTH * progress))
      : 0
  const trackY = y + BAR_OFFSET_Y

  const filledBar =
    filledWidth > 0
      ? [
          `<rect x="${CARD_PADDING_X}" y="${trackY}" width="${filledWidth}" height="${BAR_HEIGHT}" rx="${BAR_RADIUS}" fill="${resolveColor(barColor)}">`,
          `<animate attributeName="width" from="0" to="${filledWidth}" begin="${(index * 0.12).toFixed(2)}s" dur="0.9s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />`,
          '</rect>',
        ].join('')
      : ''

  const parts = [
    svgText({
      content: milestone.label,
      x: CARD_PADDING_X,
      y,
      fill: 'value',
      size: FONT_SIZE.body,
      weight: 500,
    }),
    svgText({
      content: milestone.progressText,
      x: CARD_WIDTH_PX - CARD_PADDING_X,
      y,
      fill: 'value',
      size: FONT_SIZE.body,
      font: 'mono',
      anchor: 'end',
      opacity: 0.85,
    }),
    `<rect x="${CARD_PADDING_X}" y="${trackY}" width="${CONTENT_WIDTH}" height="${BAR_HEIGHT}" rx="${BAR_RADIUS}" fill="${resolveColor('body')}" opacity="${TRACK_OPACITY}" />`,
    filledBar,
    svgText({
      content: milestone.detail,
      x: CARD_PADDING_X,
      y: y + DETAIL_OFFSET_Y,
      size: FONT_SIZE.body,
      font: 'mono',
    }),
    svgText({
      content: `${Math.round(progress * 100)}%`,
      x: CARD_WIDTH_PX - CARD_PADDING_X,
      y: y + DETAIL_OFFSET_Y,
      fill: barColor,
      size: FONT_SIZE.body,
      font: 'mono',
      anchor: 'end',
    }),
  ]

  if (!isLast) {
    parts.push(
      separator({
        y: y + SEPARATOR_OFFSET_Y,
        width: CONTENT_WIDTH,
        opacity: SEPARATOR_OPACITY,
      }),
    )
  }

  return parts.filter(Boolean).join('\n')
}

function clamp(options: { value: number; min: number; max: number }): number {
  const { value, min, max } = options
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  )
}

function addDays(options: { date: Date; days: number }): Date {
  const { date, days } = options
  return new Date(date.getTime() + days * MS_PER_DAY)
}

function daysBetween(options: { from: Date; to: Date }): number {
  const { from, to } = options
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
}

function formatDate(date: Date): string {
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

function formatMonth(date: Date): string {
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}
