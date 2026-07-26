export const COLORS = {
  background: '#0d1117',
  border: '#ff6e96',
  accent: '#ff6e96',
  accentAlt: '#79dafa',
  body: '#9f9f9f',
  value: '#e6edf3',
  healthy: '#3fb950',
  down: '#f85149',
} as const

export type ColorToken = keyof typeof COLORS

export const FONTS = {
  mono: "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
  ui: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const

export type FontToken = keyof typeof FONTS

export const CARD_WIDTH = {
  FULL: 840,
  HALF: 410,
} as const

export const CARD_RADIUS = 10
export const BORDER_OPACITY = 0.4
export const SEPARATOR_OPACITY = 0.12

/** Horizontal breathing room between the card border and its content. */
export const CARD_PADDING_X = 18

/** Baseline of the title row rendered by `cardFrame`. */
export const TITLE_BASELINE_Y = 28

/** First safe body baseline when `cardFrame` renders a title row. */
export const BODY_START_Y = 56

/** Terminal prompt glyph used across every card. */
export const PROMPT_GLYPH = '▸'

/** Gap between a `▸` prompt glyph and the label that follows it. */
export const PROMPT_LABEL_OFFSET_X = 16

export const FONT_SIZE = {
  title: 14,
  label: 11,
  body: 12,
  summary: 14,
  value: 16,
  hero: 30,
} as const

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type FormatNumberOptions = {
  /** Render as `12.4k` / `3.1M` instead of `12,431` / `3,100,000`. */
  compact?: boolean
  /** Fraction digits for compact output. Defaults to 1, trailing zero trimmed. */
  decimals?: number
  /** Prefix for positive values, e.g. `+`. */
  signed?: boolean
}

export function formatNumber(
  value: number,
  options: FormatNumberOptions = {},
): string {
  const { compact = false, decimals = 1, signed = false } = options
  const sign = signed && value > 0 ? '+' : value < 0 ? '-' : ''
  const magnitude = Math.abs(value)

  if (!compact || magnitude < 1000) {
    return `${sign}${withThousands(magnitude)}`
  }

  const unit = compactUnit({ magnitude, decimals })
  if (!unit) return `${sign}${withThousands(magnitude)}`

  const rendered = (magnitude / unit.threshold)
    .toFixed(decimals)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1')
  return `${sign}${rendered}${unit.suffix}`
}

const COMPACT_UNITS = [
  { threshold: 1_000, suffix: 'k' },
  { threshold: 1_000_000, suffix: 'M' },
  { threshold: 1_000_000_000, suffix: 'B' },
] as const

type CompactUnit = (typeof COMPACT_UNITS)[number]

function compactUnit(options: {
  magnitude: number
  decimals: number
}): CompactUnit | null {
  const { magnitude, decimals } = options
  let index = -1
  for (const [candidate, unit] of COMPACT_UNITS.entries()) {
    if (magnitude >= unit.threshold) index = candidate
  }
  if (index === -1) return null

  while (index + 1 < COMPACT_UNITS.length) {
    const unit = COMPACT_UNITS[index]
    if (!unit) break
    const rounded = Number((magnitude / unit.threshold).toFixed(decimals))
    if (rounded < 1000) break
    index += 1
  }

  return COMPACT_UNITS[index] ?? null
}

function withThousands(value: number): string {
  const rounded = Math.round(value * 100) / 100
  const [whole, fraction] = rounded.toString().split('.')
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

export type TruncateOptions = {
  maxLength: number
  /** Appended when the text is shortened. Defaults to `…`. */
  ellipsis?: string
}

export function truncate(text: string, options: TruncateOptions): string {
  const { maxLength, ellipsis = '…' } = options
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - ellipsis.length)).trimEnd()}${ellipsis}`
}

export type SvgTextOptions = {
  content: string
  x: number
  y: number
  /** Palette token or raw color. Defaults to the body text color. */
  fill?: ColorToken | string
  size?: number
  font?: FontToken
  weight?: number | 'normal' | 'bold'
  anchor?: 'start' | 'middle' | 'end'
  opacity?: number
  letterSpacing?: number
  /** Pre-escaped markup appended inside the element, e.g. `<animate .../>`. */
  children?: string
  /** Text is escaped by default; disable when passing `<tspan>` markup. */
  raw?: boolean
}

export function svgText(options: SvgTextOptions): string {
  const {
    content,
    x,
    y,
    fill = 'body',
    size = FONT_SIZE.body,
    font = 'ui',
    weight,
    anchor,
    opacity,
    letterSpacing,
    children,
    raw = false,
  } = options

  const attributes = [
    `x="${x}"`,
    `y="${y}"`,
    `fill="${resolveColor(fill)}"`,
    `font-family="${FONTS[font]}"`,
    `font-size="${size}"`,
  ]
  if (weight !== undefined) attributes.push(`font-weight="${weight}"`)
  if (anchor) attributes.push(`text-anchor="${anchor}"`)
  if (opacity !== undefined) attributes.push(`opacity="${opacity}"`)
  if (letterSpacing !== undefined) {
    attributes.push(`letter-spacing="${letterSpacing}"`)
  }

  const body = raw ? content : escapeXml(content)
  return `<text ${attributes.join(' ')}>${body}${children ?? ''}</text>`
}

export function resolveColor(fill: ColorToken | string): string {
  return fill in COLORS ? COLORS[fill as ColorToken] : fill
}

export type SeparatorOptions = {
  y: number
  /** Defaults to a full-bleed line inset by `CARD_PADDING_X`. */
  x?: number
  width: number
  color?: ColorToken | string
  opacity?: number
}

export function separator(options: SeparatorOptions): string {
  const {
    y,
    x = CARD_PADDING_X,
    width,
    color = 'body',
    opacity = SEPARATOR_OPACITY,
  } = options
  return `<line x1="${x}" y1="${y}" x2="${x + width}" y2="${y}" stroke="${resolveColor(color)}" stroke-width="1" opacity="${opacity}" />`
}

export type PromptOptions = {
  x: number
  y: number
  size?: number
  color?: ColorToken | string
}

export function prompt(options: PromptOptions): string {
  const { x, y, size = FONT_SIZE.title, color = 'accentAlt' } = options
  return svgText({
    content: PROMPT_GLYPH,
    x,
    y,
    size,
    fill: color,
    font: 'mono',
  })
}

export type CardFrameOptions = {
  width: number
  height: number
  /** Inner SVG markup, positioned in card coordinates. */
  body: string
  /** Rendered in accent pink next to a cyan `▸` prompt glyph. */
  title?: string
  /** Font stack for the title. Defaults to the UI stack. */
  titleFont?: FontToken
  /** Title is escaped by default; disable when passing `<tspan>` markup. */
  titleRaw?: boolean
  /** Muted trailing text on the title row, right-aligned. */
  meta?: string
  /** Draws a hairline under the title row. Defaults to true when titled. */
  titleRule?: boolean
  /** Extra `<defs>` content: gradients, clip paths, filters. */
  defs?: string
  /** Screen-reader label for the whole card. Defaults to `title`. */
  ariaLabel?: string
}

export function cardFrame(options: CardFrameOptions): string {
  const {
    width,
    height,
    body,
    title,
    titleFont = 'ui',
    titleRaw = false,
    meta,
    defs,
    ariaLabel,
  } = options
  const titleRule = options.titleRule ?? Boolean(title)
  const label = ariaLabel ?? title ?? 'Profile card'

  const header: string[] = []
  if (title) {
    header.push(prompt({ x: CARD_PADDING_X, y: TITLE_BASELINE_Y }))
    header.push(
      svgText({
        content: title,
        x: CARD_PADDING_X + PROMPT_LABEL_OFFSET_X,
        y: TITLE_BASELINE_Y,
        fill: 'accent',
        size: FONT_SIZE.title,
        font: titleFont,
        weight: 600,
        letterSpacing: titleFont === 'ui' ? 0.4 : undefined,
        raw: titleRaw,
      }),
    )
  }
  if (meta) {
    header.push(
      svgText({
        content: meta,
        x: width - CARD_PADDING_X,
        y: TITLE_BASELINE_Y,
        size: FONT_SIZE.label,
        font: 'mono',
        anchor: 'end',
        opacity: 0.75,
      }),
    )
  }
  if (titleRule) {
    header.push(
      separator({
        y: TITLE_BASELINE_Y + 12,
        width: width - CARD_PADDING_X * 2,
      }),
    )
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">`,
    `<title>${escapeXml(label)}</title>`,
    defs ? `<defs>${defs}</defs>` : '',
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${CARD_RADIUS}" fill="${COLORS.background}" stroke="${COLORS.border}" stroke-opacity="${BORDER_OPACITY}" stroke-width="1" />`,
    ...header,
    body,
    '</svg>',
  ]
    .filter(Boolean)
    .join('\n')
}
