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
  resolveColor,
  separator,
  svgText,
} from '../theme.ts'

const CARD_HEIGHT = 200
const DEGRADED_CARD_HEIGHT = 104

const STATUS_DOT_X = CARD_PADDING_X + 7
const STATUS_DOT_Y = 61
const STATUS_DOT_RADIUS = 5
const STATUS_BASELINE_Y = 67
const STATUS_TEXT_X = CARD_PADDING_X + 24

const TICK_COUNT = 90
const TICK_WIDTH = 6
const TICK_HEIGHT = 26
const TICK_RADIUS = 2
const TICK_TOP_Y = 86
const TICK_MIN_OPACITY = 0.5

const AXIS_BASELINE_Y = 128
const FOOTER_SEPARATOR_Y = 142
const FOOTER_BASELINE_Y = 164
const PROGRESS_TRACK_Y = 176
const PROGRESS_TRACK_HEIGHT = 4
const PROGRESS_TRACK_RADIUS = 2

const UPTIME_WINDOW_DAYS = 365
const FULL_YEAR_DAYS = 365
const MS_PER_DAY = 86_400_000
const PULSE_DURATION = '2.6s'

const UNKNOWN_OPACITY = 0.2

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

/** `pending` is today before its first commit lands; it is not a miss yet. */
type DayState = 'up' | 'down' | 'pending' | 'unknown'

type Tick = {
  date: string
  state: DayState
  count: number | null
}

type Incident = {
  date: string
  daysAgo: number
}

type RecordStreak = {
  days: number
  endDate: string | null
  ongoing: boolean
}

type StreakStatusModel = {
  status: 'operational' | 'incident'
  streakDays: number
  record: RecordStreak | null
  ticks: Tick[]
  uptimeRatio: number
  /** Days in the uptime window that actually carry a contribution count. */
  measuredDays: number
  incidentCount: number
  lastIncident: Incident | null
  remainingDays: number
  today: string
}

export function renderStreakStatus(data: ProfileData): string {
  const github = data.github
  if (!github) return renderDegraded()

  const model = buildModel({
    dailyCounts: github.dailyCounts,
    streakDays: github.currentStreakDays,
    lastZeroDate: github.lastZeroDate,
    longestStreakDays: github.longestStreakDays,
    longestStreakEndDate: github.longestStreakEndDate,
    generatedAt: data.generatedAt,
  })

  const innerWidth = CARD_WIDTH.FULL - CARD_PADDING_X * 2
  const body = [
    renderStatusDot({ status: model.status }),
    renderStatusLine({
      status: model.status,
      streakDays: model.streakDays,
      lastIncident: model.lastIncident,
    }),
    renderUptimeReadout({
      uptimeRatio: model.uptimeRatio,
      incidentCount: model.incidentCount,
      measuredDays: model.measuredDays,
    }),
    renderTicks({ ticks: model.ticks, innerWidth }),
    renderAxis({ innerWidth, days: model.ticks.length }),
    separator({ y: FOOTER_SEPARATOR_Y, width: innerWidth }),
    renderIncidentLine({ incident: model.lastIncident }),
    renderRecordLine({ record: model.record }),
    renderProgressLabel({
      streakDays: model.streakDays,
      remainingDays: model.remainingDays,
    }),
    renderProgressBar({ streakDays: model.streakDays, innerWidth }),
  ].join('\n')

  return cardFrame({
    width: CARD_WIDTH.FULL,
    height: CARD_HEIGHT,
    title: 'commit uptime',
    meta: `checked ${formatShortDate(model.today)}`,
    body,
    ariaLabel: `Commit streak status: ${model.status}, ${model.streakDays} days without a missed commit`,
  })
}

function renderDegraded(): string {
  const body = [
    `<circle cx="${STATUS_DOT_X}" cy="${STATUS_DOT_Y}" r="${STATUS_DOT_RADIUS}" fill="${COLORS.body}" opacity="0.5" />`,
    svgText({
      content: 'No data',
      x: STATUS_TEXT_X,
      y: STATUS_BASELINE_Y,
      fill: 'value',
      size: FONT_SIZE.value,
      weight: 600,
    }),
    svgText({
      content: 'The GitHub slice failed to fetch on the last run.',
      x: STATUS_TEXT_X,
      y: STATUS_BASELINE_Y + 22,
      size: FONT_SIZE.summary,
    }),
  ].join('\n')

  return cardFrame({
    width: CARD_WIDTH.FULL,
    height: DEGRADED_CARD_HEIGHT,
    title: 'commit uptime',
    body,
    ariaLabel: 'Commit streak status: no data',
  })
}

function renderStatusDot(options: {
  status: StreakStatusModel['status']
}): string {
  if (options.status === 'incident') {
    return `<circle cx="${STATUS_DOT_X}" cy="${STATUS_DOT_Y}" r="${STATUS_DOT_RADIUS}" fill="${COLORS.down}" />`
  }

  const pulse = `<animate attributeName="opacity" values="1;0.35;1" dur="${PULSE_DURATION}" repeatCount="indefinite" />`
  const ringRadius = `<animate attributeName="r" values="${STATUS_DOT_RADIUS};${STATUS_DOT_RADIUS + 7}" dur="${PULSE_DURATION}" repeatCount="indefinite" />`
  const ringFade = `<animate attributeName="opacity" values="0.45;0" dur="${PULSE_DURATION}" repeatCount="indefinite" />`

  return [
    `<circle cx="${STATUS_DOT_X}" cy="${STATUS_DOT_Y}" r="${STATUS_DOT_RADIUS}" fill="none" stroke="${COLORS.healthy}" stroke-width="1">${ringRadius}${ringFade}</circle>`,
    `<circle cx="${STATUS_DOT_X}" cy="${STATUS_DOT_Y}" r="${STATUS_DOT_RADIUS}" fill="${COLORS.healthy}">${pulse}</circle>`,
  ].join('\n')
}

function renderStatusLine(options: {
  status: StreakStatusModel['status']
  streakDays: number
  lastIncident: Incident | null
}): string {
  const { status, streakDays, lastIncident } = options
  const summary = `font-size="${FONT_SIZE.summary}"`
  const content =
    status === 'incident'
      ? [
          `<tspan font-weight="600" fill="${COLORS.down}">Incident</tspan>`,
          `<tspan dx="9" ${summary} opacity="0.5">·</tspan>`,
          `<tspan dx="9" ${summary}>streak reset ${escapeXml(resetLabel(lastIncident))}</tspan>`,
        ].join('')
      : [
          `<tspan font-weight="600" fill="${COLORS.healthy}">Operational</tspan>`,
          `<tspan dx="9" ${summary} opacity="0.5">·</tspan>`,
          `<tspan dx="9" font-family="${FONTS.mono}" ${summary} font-weight="600" fill="${COLORS.value}">${escapeXml(formatNumber(streakDays))} days</tspan>`,
          `<tspan ${summary}> without a missed commit</tspan>`,
        ].join('')

  return svgText({
    content,
    x: STATUS_TEXT_X,
    y: STATUS_BASELINE_Y,
    size: FONT_SIZE.value,
    raw: true,
  })
}

function resetLabel(incident: Incident | null): string {
  return incident ? formatLongDate(incident.date) : 'recently'
}

function renderUptimeReadout(options: {
  uptimeRatio: number
  incidentCount: number
  measuredDays: number
}): string {
  const { uptimeRatio, incidentCount, measuredDays } = options
  const percent = `${(uptimeRatio * 100).toFixed(2)}%`
  const incidents = `${incidentCount} incident${incidentCount === 1 ? '' : 's'} / ${measuredDays}d`
  const content = [
    `<tspan>${escapeXml(incidents)}</tspan>`,
    `<tspan dx="10" opacity="0.5">·</tspan>`,
    `<tspan dx="10">uptime </tspan>`,
    `<tspan font-weight="600" fill="${incidentCount > 0 ? COLORS.value : COLORS.healthy}">${percent}</tspan>`,
  ].join('')

  return svgText({
    content,
    x: CARD_WIDTH.FULL - CARD_PADDING_X,
    y: STATUS_BASELINE_Y - 1,
    size: FONT_SIZE.body,
    font: 'mono',
    anchor: 'end',
    raw: true,
  })
}

function renderTicks(options: { ticks: Tick[]; innerWidth: number }): string {
  const { ticks, innerWidth } = options
  const pitch = (innerWidth - TICK_WIDTH) / Math.max(1, ticks.length - 1)
  const peak = ticks.reduce(
    (highest, tick) => Math.max(highest, tick.count ?? 0),
    0,
  )
  const lastIndex = ticks.length - 1

  return ticks
    .map((tick, index) => {
      const x = CARD_PADDING_X + index * pitch
      const attributes = [
        `x="${round(x)}"`,
        `y="${TICK_TOP_Y}"`,
        `width="${TICK_WIDTH}"`,
        `height="${TICK_HEIGHT}"`,
        `rx="${TICK_RADIUS}"`,
        `fill="${tickFill(tick)}"`,
        `opacity="${tickOpacity({ tick, peak })}"`,
      ]
      const isToday = index === lastIndex && tick.state === 'up'
      const animation = isToday
        ? `<animate attributeName="opacity" values="1;0.45;1" dur="${PULSE_DURATION}" repeatCount="indefinite" />`
        : ''
      return animation
        ? `<rect ${attributes.join(' ')}>${animation}</rect>`
        : `<rect ${attributes.join(' ')} />`
    })
    .join('\n')
}

function tickFill(tick: Tick): string {
  if (tick.state === 'down') return COLORS.down
  if (tick.state === 'up') return COLORS.healthy
  return resolveColor('body')
}

function tickOpacity(options: { tick: Tick; peak: number }): number {
  const { tick, peak } = options
  if (tick.state === 'unknown' || tick.state === 'pending') {
    return UNKNOWN_OPACITY
  }
  if (tick.state === 'down') return 0.85
  if (tick.count === null || peak <= 0) return 0.8
  const share = Math.min(1, tick.count / peak)
  return round(TICK_MIN_OPACITY + (1 - TICK_MIN_OPACITY) * share)
}

function renderAxis(options: { innerWidth: number; days: number }): string {
  return [
    svgText({
      content: `${options.days} days ago`,
      x: CARD_PADDING_X,
      y: AXIS_BASELINE_Y,
      size: FONT_SIZE.label,
      font: 'mono',
      opacity: 0.6,
    }),
    svgText({
      content: 'daily commit activity',
      x: CARD_PADDING_X + options.innerWidth / 2,
      y: AXIS_BASELINE_Y,
      size: FONT_SIZE.label,
      anchor: 'middle',
      opacity: 0.45,
    }),
    svgText({
      content: 'today',
      x: CARD_WIDTH.FULL - CARD_PADDING_X,
      y: AXIS_BASELINE_Y,
      size: FONT_SIZE.label,
      font: 'mono',
      anchor: 'end',
      opacity: 0.6,
    }),
  ].join('\n')
}

function renderIncidentLine(options: { incident: Incident | null }): string {
  const { incident } = options
  if (!incident) {
    return svgText({
      content: 'Last incident: none on record',
      x: CARD_PADDING_X,
      y: FOOTER_BASELINE_Y,
      size: FONT_SIZE.summary,
    })
  }

  const content = [
    `<tspan>Last incident: </tspan>`,
    `<tspan fill="${COLORS.value}">${escapeXml(formatLongDate(incident.date))}</tspan>`,
    `<tspan dx="8" opacity="0.5">·</tspan>`,
    `<tspan dx="8">${escapeXml(formatRelativeDays(incident.daysAgo))}</tspan>`,
  ].join('')

  return svgText({
    content,
    x: CARD_PADDING_X,
    y: FOOTER_BASELINE_Y,
    size: FONT_SIZE.summary,
    raw: true,
  })
}

function renderRecordLine(options: { record: RecordStreak | null }): string {
  const { record } = options
  if (!record || record.days <= 0) return ''

  const qualifier = record.ongoing
    ? 'ongoing'
    : record.endDate
      ? formatMonthYear(record.endDate)
      : null
  const content = [
    `<tspan>record </tspan>`,
    `<tspan font-weight="600" fill="${COLORS.value}">${escapeXml(formatNumber(record.days))} days</tspan>`,
    ...(qualifier
      ? [
          `<tspan dx="10" opacity="0.5">·</tspan>`,
          `<tspan dx="10" fill="${record.ongoing ? COLORS.healthy : resolveColor('body')}">${escapeXml(qualifier)}</tspan>`,
        ]
      : []),
  ].join('')

  return svgText({
    content,
    x: CARD_WIDTH.FULL / 2,
    y: FOOTER_BASELINE_Y,
    size: FONT_SIZE.body,
    font: 'mono',
    anchor: 'middle',
    raw: true,
  })
}

function renderProgressLabel(options: {
  streakDays: number
  remainingDays: number
}): string {
  const { streakDays, remainingDays } = options
  const progress = `${formatNumber(Math.min(streakDays, FULL_YEAR_DAYS))} / ${FULL_YEAR_DAYS}`
  const tail =
    remainingDays > 0
      ? `${formatNumber(remainingDays)} days to a full year`
      : 'full year cleared'
  const content = [
    `<tspan fill="${COLORS.accentAlt}">${escapeXml(progress)}</tspan>`,
    `<tspan dx="10" opacity="0.5">·</tspan>`,
    `<tspan dx="10">${escapeXml(tail)}</tspan>`,
  ].join('')

  return svgText({
    content,
    x: CARD_WIDTH.FULL - CARD_PADDING_X,
    y: FOOTER_BASELINE_Y,
    size: FONT_SIZE.body,
    font: 'mono',
    anchor: 'end',
    raw: true,
  })
}

function renderProgressBar(options: {
  streakDays: number
  innerWidth: number
}): string {
  const { streakDays, innerWidth } = options
  const share = Math.max(0, Math.min(1, streakDays / FULL_YEAR_DAYS))
  const filled = round(innerWidth * share)

  return [
    `<rect x="${CARD_PADDING_X}" y="${PROGRESS_TRACK_Y}" width="${innerWidth}" height="${PROGRESS_TRACK_HEIGHT}" rx="${PROGRESS_TRACK_RADIUS}" fill="${COLORS.body}" opacity="0.14" />`,
    `<rect x="${CARD_PADDING_X}" y="${PROGRESS_TRACK_Y}" width="${filled}" height="${PROGRESS_TRACK_HEIGHT}" rx="${PROGRESS_TRACK_RADIUS}" fill="${COLORS.healthy}" opacity="0.8" />`,
    `<rect x="${round(CARD_PADDING_X + filled - 1)}" y="${PROGRESS_TRACK_Y - 3}" width="2" height="${PROGRESS_TRACK_HEIGHT + 6}" rx="1" fill="${COLORS.accentAlt}" opacity="0.85" />`,
  ].join('\n')
}

function buildModel(options: {
  dailyCounts: ContributionDay[]
  streakDays: number
  lastZeroDate: string | null
  longestStreakDays: number
  longestStreakEndDate: string | null
  generatedAt: string
}): StreakStatusModel {
  const {
    dailyCounts,
    streakDays,
    lastZeroDate,
    longestStreakDays,
    longestStreakEndDate,
    generatedAt,
  } = options

  const today = resolveToday({ dailyCounts, generatedAt })
  const counts = new Map(dailyCounts.map((day) => [day.date, day.count]))
  const resolve = (date: string): DayState =>
    resolveDayState({ date, counts, today })

  const tickCount = Math.max(1, Math.min(TICK_COUNT, dailyCounts.length))
  const ticks = buildWindow({ today, days: tickCount }).map((date) => ({
    date,
    state: resolve(date),
    count: counts.get(date) ?? null,
  }))

  const uptimeWindow = buildWindow({ today, days: UPTIME_WINDOW_DAYS })
    .map(resolve)
    .filter((state) => state === 'up' || state === 'down')
  const missedDays = uptimeWindow.filter((state) => state === 'down').length
  const incidentCount = uptimeWindow.filter(
    (state, index) => state === 'down' && uptimeWindow[index - 1] !== 'down',
  ).length
  const measuredDays = uptimeWindow.length

  return {
    status: streakDays > 0 ? 'operational' : 'incident',
    streakDays,
    record:
      longestStreakDays > 0
        ? {
            days: longestStreakDays,
            endDate: longestStreakEndDate,
            ongoing: streakDays > 0 && streakDays >= longestStreakDays,
          }
        : null,
    ticks,
    uptimeRatio:
      measuredDays > 0 ? (measuredDays - missedDays) / measuredDays : 1,
    measuredDays,
    incidentCount,
    lastIncident: lastZeroDate
      ? { date: lastZeroDate, daysAgo: daysBetween(lastZeroDate, today) }
      : null,
    remainingDays: Math.max(0, FULL_YEAR_DAYS - streakDays),
    today,
  }
}

function resolveDayState(options: {
  date: string
  counts: Map<string, number>
  today: string
}): DayState {
  const { date, counts, today } = options

  const count = counts.get(date)
  if (count === undefined) return 'unknown'
  if (count > 0) return 'up'
  return date === today ? 'pending' : 'down'
}

function resolveToday(options: {
  dailyCounts: ContributionDay[]
  generatedAt: string
}): string {
  const latest = options.dailyCounts.at(-1)?.date
  return latest ?? options.generatedAt.slice(0, 10)
}

function buildWindow(options: { today: string; days: number }): string[] {
  const { today, days } = options
  const end = parseIsoDate(today).getTime()
  return Array.from({ length: days }, (_, index) =>
    toIsoDate(new Date(end - (days - 1 - index) * MS_PER_DAY)),
  )
}

function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const span = parseIsoDate(to).getTime() - parseIsoDate(from).getTime()
  return Math.round(span / MS_PER_DAY)
}

function formatLongDate(date: string): string {
  const parsed = parseIsoDate(date)
  const month = MONTH_LABELS[parsed.getUTCMonth()] ?? ''
  return `${month} ${parsed.getUTCDate()}, ${parsed.getUTCFullYear()}`
}

function formatMonthYear(date: string): string {
  const parsed = parseIsoDate(date)
  const month = MONTH_LABELS[parsed.getUTCMonth()] ?? ''
  return `${month} ${parsed.getUTCFullYear()}`
}

function formatShortDate(date: string): string {
  const parsed = parseIsoDate(date)
  const month = MONTH_LABELS[parsed.getUTCMonth()] ?? ''
  return `${parsed.getUTCDate()} ${month} ${parsed.getUTCFullYear()}`
}

function formatRelativeDays(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 45) return `${days} days ago`

  const months = Math.floor(days / 30.44)
  if (months < 12) return `${months} months ago`

  const years = Math.floor(months / 12)
  const trailingMonths = months % 12
  const yearLabel = `${years} year${years === 1 ? '' : 's'}`
  if (trailingMonths === 0) return `${yearLabel} ago`
  return `${yearLabel} ${trailingMonths} months ago`
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
