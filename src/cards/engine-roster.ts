import type { ProfileData } from '../index.ts'
import type { EngineRelease, EnginesData } from '../fetch/engines.ts'
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
  separator,
  svgText,
  truncate,
} from '../theme.ts'

const CARD_TITLE = 'every database, in seconds'
const HOME_LABEL = 'layerbase.com'
const SURFACES_LABEL = 'CLI, desktop & cloud'
const UNAVAILABLE_NOTE = 'registry unreachable - roster returns on the next run'

const WIDTH = CARD_WIDTH.FULL
const CONTENT_WIDTH = WIDTH - CARD_PADDING_X * 2
const RIGHT_EDGE = WIDTH - CARD_PADDING_X

const COLUMNS = 4
const CHIP_GUTTER = 11
const CHIP_WIDTH = (CONTENT_WIDTH - CHIP_GUTTER * (COLUMNS - 1)) / COLUMNS
const COLUMN_PITCH = CHIP_WIDTH + CHIP_GUTTER
const CHIP_HEIGHT = 26
const CHIP_RADIUS = 6
const ROW_PITCH = 34
const GRID_TOP_Y = 52
const MAX_CHIPS = COLUMNS * 7

const CHIP_FILL_OPACITY = 0.05
const CHIP_STROKE_OPACITY = 0.16
const INDICATOR_OFFSET_X = 11
const INDICATOR_RADIUS = 3
const NAME_OFFSET_X = 22
const TEXT_BASELINE_OFFSET_Y = 17
const VERSION_INSET_X = 10
const VERSION_MAX_LENGTH = 12

const FOOTER_RULE_GAP_Y = 16
const FOOTER_BASELINE_GAP_Y = 21
const BOTTOM_PADDING_Y = 18

const CURSOR_KEYFRAMES = '1;0.3;1'
const CURSOR_DURATION = '3.2s'

const ENGINE_LABELS: Record<string, string> = {
  clickhouse: 'ClickHouse',
  cockroachdb: 'CockroachDB',
  couchdb: 'CouchDB',
  duckdb: 'DuckDB',
  ferretdb: 'FerretDB',
  influxdb: 'InfluxDB',
  libsql: 'libSQL',
  mariadb: 'MariaDB',
  meilisearch: 'Meilisearch',
  mongodb: 'MongoDB',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  'postgresql-documentdb': 'DocumentDB',
  qdrant: 'Qdrant',
  questdb: 'QuestDB',
  redis: 'Redis',
  sqlite: 'SQLite',
  surrealdb: 'SurrealDB',
  tigerbeetle: 'TigerBeetle',
  typedb: 'TypeDB',
  valkey: 'Valkey',
  weaviate: 'Weaviate',
}

const PLATFORM_LABELS: Record<string, string> = {
  darwin: 'macOS',
  linux: 'Linux',
  win32: 'Windows',
}

const PLATFORM_ORDER = ['darwin', 'linux', 'win32']

export function renderEngineRoster(data: ProfileData): string {
  if (!data.engines || data.engines.engines.length === 0) {
    return renderUnavailable()
  }
  return renderCard(data.engines)
}

function renderCard(engines: EnginesData): string {
  const roster = [...engines.engines].sort((left, right) =>
    engineLabel(left.name).localeCompare(engineLabel(right.name)),
  )
  const visible = roster.slice(0, MAX_CHIPS)
  const overflow = roster.length - visible.length

  const rowCount = Math.ceil(visible.length / COLUMNS)
  const gridBottomY = GRID_TOP_Y + (rowCount - 1) * ROW_PITCH + CHIP_HEIGHT
  const footerRuleY = gridBottomY + FOOTER_RULE_GAP_Y
  const footerBaselineY = footerRuleY + FOOTER_BASELINE_GAP_Y
  const height = footerBaselineY + BOTTOM_PADDING_Y

  const body = [
    ...visible.map((engine, index) => renderChip({ engine, index })),
    separator({ y: footerRuleY, width: CONTENT_WIDTH }),
    ...renderFooter({ engines, overflow, baselineY: footerBaselineY }),
  ].join('\n')

  return cardFrame({
    width: WIDTH,
    height,
    title: CARD_TITLE,
    meta: `${formatNumber(engines.engineCount)} engines · ${SURFACES_LABEL} · ${HOME_LABEL}`,
    ariaLabel: `${CARD_TITLE}: ${engines.engineCount} database engines and ${engines.versionCount} pinned versions available through Layerbase`,
    body,
  })
}

function renderChip(options: { engine: EngineRelease; index: number }): string {
  const { engine, index } = options
  const column = index % COLUMNS
  const row = Math.floor(index / COLUMNS)
  const x = CARD_PADDING_X + column * COLUMN_PITCH
  const y = GRID_TOP_Y + row * ROW_PITCH
  const baselineY = y + TEXT_BASELINE_OFFSET_Y

  return [
    `<rect x="${round(x)}" y="${y}" width="${round(CHIP_WIDTH)}" height="${CHIP_HEIGHT}" rx="${CHIP_RADIUS}" fill="${COLORS.body}" fill-opacity="${CHIP_FILL_OPACITY}" stroke="${COLORS.accentAlt}" stroke-opacity="${CHIP_STROKE_OPACITY}" stroke-width="1" />`,
    `<circle cx="${round(x + INDICATOR_OFFSET_X)}" cy="${y + CHIP_HEIGHT / 2}" r="${INDICATOR_RADIUS}" fill="${COLORS.healthy}" />`,
    svgText({
      content: engineLabel(engine.name),
      x: round(x + NAME_OFFSET_X),
      y: baselineY,
      fill: 'value',
      size: FONT_SIZE.body,
      font: 'mono',
      weight: 500,
    }),
    svgText({
      content: truncate(engine.latestVersion, {
        maxLength: VERSION_MAX_LENGTH,
      }),
      x: round(x + CHIP_WIDTH - VERSION_INSET_X),
      y: baselineY,
      fill: 'accentAlt',
      size: FONT_SIZE.label,
      font: 'mono',
      anchor: 'end',
      opacity: 0.85,
    }),
  ].join('\n')
}

function renderFooter(options: {
  engines: EnginesData
  overflow: number
  baselineY: number
}): string[] {
  const { engines, overflow, baselineY } = options
  const notes = [
    `${formatNumber(engines.versionCount)} pinned versions`,
    platformSummary(engines.engines),
  ]
  if (overflow > 0) notes.push(`+${formatNumber(overflow)} more engines`)

  return [
    svgText({
      content: PROMPT_GLYPH,
      x: CARD_PADDING_X,
      y: baselineY,
      fill: 'accentAlt',
      size: FONT_SIZE.label,
      font: 'mono',
      children: `<animate attributeName="opacity" values="${CURSOR_KEYFRAMES}" dur="${CURSOR_DURATION}" repeatCount="indefinite" />`,
    }),
    svgText({
      content: notes.join(' · '),
      x: CARD_PADDING_X + PROMPT_LABEL_OFFSET_X,
      y: baselineY,
      size: FONT_SIZE.label,
      font: 'mono',
      opacity: 0.8,
    }),
    svgText({
      content: `spun up from ${sourceLabel(engines.source)}`,
      x: RIGHT_EDGE,
      y: baselineY,
      size: FONT_SIZE.label,
      font: 'mono',
      anchor: 'end',
      opacity: 0.6,
    }),
  ]
}

function platformSummary(engines: EngineRelease[]): string {
  const families = new Set<string>()
  for (const engine of engines) {
    for (const platform of engine.platforms) {
      const family = platform.split('-')[0]
      if (family && PLATFORM_LABELS[family]) families.add(family)
    }
  }

  const labels = PLATFORM_ORDER.filter((family) => families.has(family)).map(
    (family) => PLATFORM_LABELS[family] ?? family,
  )
  if (labels.length === 0) return 'prebuilt binaries'
  if (labels.length === 1) return `${labels[0]} binaries`

  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`
}

function engineLabel(name: string): string {
  const known = ENGINE_LABELS[name]
  if (known) return known

  return name
    .split('-')
    .map((segment) =>
      segment.endsWith('db')
        ? `${capitalize(segment.slice(0, -2))}DB`
        : capitalize(segment),
    )
    .join(' ')
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function sourceLabel(source: string): string {
  try {
    return new URL(source).hostname
  } catch (error: unknown) {
    return 'the Layerbase registry'
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function renderUnavailable(): string {
  return cardFrame({
    width: WIDTH,
    height: 96,
    title: CARD_TITLE,
    meta: `${SURFACES_LABEL} · ${HOME_LABEL}`,
    ariaLabel: `${CARD_TITLE}: engine roster unavailable`,
    body: svgText({
      content: UNAVAILABLE_NOTE,
      x: CARD_PADDING_X,
      y: BODY_START_Y + 8,
      size: FONT_SIZE.body,
      font: 'mono',
      opacity: 0.8,
    }),
  })
}
