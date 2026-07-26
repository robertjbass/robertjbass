import type { ProfileData } from '../index.ts'
import type { OssPrRepo } from '../fetch/oss-prs.ts'
import {
  CARD_PADDING_X,
  CARD_WIDTH,
  FONT_SIZE,
  PROMPT_GLYPH,
  PROMPT_LABEL_OFFSET_X,
  cardFrame,
  escapeXml,
  formatNumber,
  resolveColor,
  separator,
  svgText,
  truncate,
} from '../theme.ts'

const CARD_TITLE = 'oss contributions'
const FOOTER_NOTE = 'community projects + my own open source'
const EMPTY_NOTE = 'No merged pull requests found'

const CONTENT_WIDTH = CARD_WIDTH.HALF - CARD_PADDING_X * 2
const HERO_BASELINE_Y = 84
const HERO_LABEL_BASELINE_Y = 71
const HERO_SUBLABEL_BASELINE_Y = 87
const HERO_RULE_Y = 102
const HERO_GAP_X = 14
const ROW_HEIGHT = 22
const FIRST_ROW_OFFSET_Y = 20
const RANK_COLUMN_WIDTH = 24
const ROW_RULE_OFFSET_Y = 11
const FOOTER_TEXT_OFFSET_Y = 22
const BOTTOM_PADDING_Y = 20
const MAX_ROWS = 8
const REPO_NAME_MAX_LENGTH = 38
const MONO_ADVANCE_RATIO = 0.6
const CURSOR_KEYFRAMES = '1;0.3;1'
const CURSOR_DURATION = '3.2s'

export function renderOssScoreboard(data: ProfileData): string {
  const oss = data.ossPrs
  const repos = oss?.repos ?? []
  const visible = repos.slice(0, MAX_ROWS)
  const overflow = repos.length - visible.length

  const rowCount = visible.length + (overflow > 0 ? 1 : 0)
  const lastRowBaselineY = rowCount
    ? HERO_RULE_Y + FIRST_ROW_OFFSET_Y + (rowCount - 1) * ROW_HEIGHT
    : HERO_RULE_Y + FIRST_ROW_OFFSET_Y
  const footerRuleY = lastRowBaselineY + ROW_RULE_OFFSET_Y
  const footerBaselineY = footerRuleY + FOOTER_TEXT_OFFSET_Y
  const height = footerBaselineY + BOTTOM_PADDING_Y

  const body = [
    renderHero({
      totalMergedPrs: oss?.totalMergedPrs ?? 0,
      repoCount: oss?.repoCount ?? 0,
    }),
    separator({ y: HERO_RULE_Y, width: CONTENT_WIDTH }),
    ...(rowCount
      ? renderRows({ repos: visible, overflow })
      : [
          svgText({
            content: EMPTY_NOTE,
            x: CARD_PADDING_X,
            y: HERO_RULE_Y + FIRST_ROW_OFFSET_Y,
            size: FONT_SIZE.body,
          }),
        ]),
    separator({ y: footerRuleY, width: CONTENT_WIDTH }),
    renderFooter(footerBaselineY),
  ].join('\n')

  return cardFrame({
    width: CARD_WIDTH.HALF,
    height,
    title: CARD_TITLE,
    meta: `${formatNumber(oss?.repoCount ?? 0)} tracked`,
    body,
    ariaLabel: `${CARD_TITLE}: ${oss?.totalMergedPrs ?? 0} merged pull requests across ${oss?.repoCount ?? 0} repositories`,
  })
}

function renderHero(options: {
  totalMergedPrs: number
  repoCount: number
}): string {
  const { totalMergedPrs, repoCount } = options
  const heroValue = formatNumber(totalMergedPrs)
  const labelX =
    CARD_PADDING_X + monoWidth(heroValue, FONT_SIZE.hero) + HERO_GAP_X

  return [
    svgText({
      content: heroValue,
      x: CARD_PADDING_X,
      y: HERO_BASELINE_Y,
      fill: 'accent',
      size: FONT_SIZE.hero,
      font: 'mono',
      weight: 700,
    }),
    svgText({
      content: 'MERGED PULL REQUESTS',
      x: labelX,
      y: HERO_LABEL_BASELINE_Y,
      fill: 'value',
      size: FONT_SIZE.label,
      weight: 600,
      letterSpacing: 0.9,
    }),
    svgText({
      content: `across <tspan fill="${resolveColor('accentAlt')}">${formatNumber(repoCount)}</tspan> repositories`,
      x: labelX,
      y: HERO_SUBLABEL_BASELINE_Y,
      size: FONT_SIZE.label,
      raw: true,
    }),
  ].join('\n')
}

function renderRows(options: {
  repos: OssPrRepo[]
  overflow: number
}): string[] {
  const { repos, overflow } = options
  const nameX = CARD_PADDING_X + RANK_COLUMN_WIDTH
  const markup: string[] = []

  repos.forEach((entry, index) => {
    const baselineY = HERO_RULE_Y + FIRST_ROW_OFFSET_Y + index * ROW_HEIGHT

    markup.push(
      svgText({
        content: String(index + 1).padStart(2, '0'),
        x: CARD_PADDING_X,
        y: baselineY,
        size: FONT_SIZE.label,
        font: 'mono',
        opacity: 0.45,
      }),
      svgText({
        content: repoLabel(entry.repo),
        x: nameX,
        y: baselineY,
        size: FONT_SIZE.body,
        font: 'mono',
        raw: true,
      }),
    )

    const isLast = index === repos.length - 1 && overflow <= 0
    if (!isLast) {
      markup.push(
        separator({ y: baselineY + ROW_RULE_OFFSET_Y, width: CONTENT_WIDTH }),
      )
    }
  })

  if (overflow > 0) {
    markup.push(
      svgText({
        content: `+ ${formatNumber(overflow)} more`,
        x: nameX,
        y: HERO_RULE_Y + FIRST_ROW_OFFSET_Y + repos.length * ROW_HEIGHT,
        size: FONT_SIZE.label,
        font: 'mono',
        opacity: 0.6,
      }),
    )
  }

  return markup
}

function renderFooter(baselineY: number): string {
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
      content: FOOTER_NOTE,
      x: CARD_PADDING_X + PROMPT_LABEL_OFFSET_X,
      y: baselineY,
      size: FONT_SIZE.label,
      opacity: 0.8,
    }),
  ].join('\n')
}

function repoLabel(repo: string): string {
  const shortened = truncate(repo, { maxLength: REPO_NAME_MAX_LENGTH })
  const slashIndex = shortened.indexOf('/')
  if (slashIndex === -1) {
    return `<tspan fill="${resolveColor('value')}">${escapeXml(shortened)}</tspan>`
  }

  const owner = shortened.slice(0, slashIndex + 1)
  const name = shortened.slice(slashIndex + 1)
  return [
    `<tspan fill="${resolveColor('body')}">${escapeXml(owner)}</tspan>`,
    `<tspan fill="${resolveColor('value')}">${escapeXml(name)}</tspan>`,
  ].join('')
}

function monoWidth(text: string, size: number): number {
  return Math.round(text.length * size * MONO_ADVANCE_RATIO)
}
