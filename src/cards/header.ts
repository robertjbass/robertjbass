import {
  CARD_PADDING_X,
  CARD_WIDTH,
  COLORS,
  FONT_SIZE,
  PROMPT_GLYPH,
  PROMPT_LABEL_OFFSET_X,
  TITLE_BASELINE_Y,
  escapeXml,
  cardFrame,
  separator,
  svgText,
  type ColorToken,
} from '../theme.ts'

const TYPED_LINES = [
  "Hi, I'm Bob Bass",
  'Head of Engineering @ Efficient App',
  'Founder of Layerbase',
  'I really, really love databases',
  'TypeScript enthusiast',
]

const SUBTITLE_SEGMENTS: {
  text: string
  fill: ColorToken
  opacity?: number
}[] = [
  { text: '🦬🗽 WNY', fill: 'value' },
  { text: '  →  ', fill: 'accentAlt', opacity: 0.75 },
  { text: '🌉 SF', fill: 'value' },
  { text: '  →  ', fill: 'accentAlt', opacity: 0.75 },
  { text: '🤠 ATX', fill: 'value' },
]

const CARD_HEIGHT = 164
const KICKER_RULE_Y = TITLE_BASELINE_Y + 12
const HERO_BASELINE_Y = 98
const HERO_SIZE = FONT_SIZE.hero + 4
const SUBTITLE_BASELINE_Y = 136
const KICKER_LABEL = 'whoami'
const KICKER_META = '@robertjbass'
const MONO_WIDTH_RATIO = 0.605
const CARET_WIDTH = 12
const CARET_HEIGHT = 27
const CARET_GAP = 4
const CARET_BLINK_SECONDS = 1.05
const TYPE_STEP_SECONDS = 0.075
const HOLD_SECONDS = 1.5
const DELETE_STEP_SECONDS = 0.035
const DELETE_CHARS_PER_STEP = 3
const CLEAR_SECONDS = 0.32
const SHUTTER_TOP_Y = 60
const SHUTTER_HEIGHT = 54

type TypingFrame = {
  seconds: number
  lineIndex: number
  charCount: number
}

type TypingTimeline = {
  frames: TypingFrame[]
  totalSeconds: number
}

export function renderHeader(): string {
  const timeline = buildTimeline({ lines: TYPED_LINES })
  const contentWidth = CARD_WIDTH.FULL - CARD_PADDING_X * 2
  const keyTimes = timeline.frames.map((frame) =>
    round(frame.seconds / timeline.totalSeconds, 5),
  )

  const body = [
    svgText({
      content: PROMPT_GLYPH,
      x: CARD_PADDING_X,
      y: TITLE_BASELINE_Y,
      fill: 'accentAlt',
      size: FONT_SIZE.label,
      font: 'mono',
    }),
    svgText({
      content: KICKER_LABEL,
      x: CARD_PADDING_X + PROMPT_LABEL_OFFSET_X,
      y: TITLE_BASELINE_Y,
      fill: 'accent',
      size: FONT_SIZE.label,
      font: 'mono',
      letterSpacing: 2.4,
      opacity: 0.9,
    }),
    svgText({
      content: KICKER_META,
      x: CARD_WIDTH.FULL - CARD_PADDING_X,
      y: TITLE_BASELINE_Y,
      size: FONT_SIZE.label,
      font: 'mono',
      anchor: 'end',
      opacity: 0.65,
    }),
    separator({ y: KICKER_RULE_Y, x: CARD_PADDING_X, width: contentWidth }),
    renderTypedLines({ timeline, keyTimes }),
    renderShutter({ timeline, keyTimes }),
    renderCaret({ timeline, keyTimes }),
    renderSubtitle(),
  ]

  return cardFrame({
    width: CARD_WIDTH.FULL,
    height: CARD_HEIGHT,
    ariaLabel: buildAriaLabel(),
    body: body.join('\n'),
  })
}

function buildTimeline(options: { lines: string[] }): TypingTimeline {
  const { lines } = options
  const frames: TypingFrame[] = []
  let seconds = 0

  for (const [lineIndex, line] of lines.entries()) {
    for (let charCount = 0; charCount <= line.length; charCount += 1) {
      frames.push({ seconds, lineIndex, charCount })
      seconds += TYPE_STEP_SECONDS
    }

    seconds += HOLD_SECONDS

    for (
      let charCount = line.length - DELETE_CHARS_PER_STEP;
      charCount > 0;
      charCount -= DELETE_CHARS_PER_STEP
    ) {
      frames.push({ seconds, lineIndex, charCount })
      seconds += DELETE_STEP_SECONDS
    }

    frames.push({ seconds, lineIndex, charCount: 0 })
    seconds += CLEAR_SECONDS
  }

  return { frames, totalSeconds: seconds }
}

function renderTypedLines(options: {
  timeline: TypingTimeline
  keyTimes: number[]
}): string {
  const { timeline, keyTimes } = options
  const lines = TYPED_LINES.map((line, lineIndex) =>
    svgText({
      content: line,
      x: CARD_PADDING_X,
      y: HERO_BASELINE_Y,
      fill: 'accent',
      size: HERO_SIZE,
      font: 'mono',
      weight: 700,
      opacity: lineIndex === 0 ? 1 : 0,
      children: renderVisibilityAnimation({ timeline, keyTimes, lineIndex }),
    }),
  )

  return lines.join('\n')
}

function renderVisibilityAnimation(options: {
  timeline: TypingTimeline
  keyTimes: number[]
  lineIndex: number
}): string {
  const { timeline, keyTimes, lineIndex } = options
  const firstFrame = timeline.frames.findIndex(
    (frame) => frame.lineIndex === lineIndex,
  )
  const nextFrame = timeline.frames.findIndex(
    (frame) => frame.lineIndex === lineIndex + 1,
  )

  const start = keyTimes[firstFrame] ?? 0
  const points: { keyTime: number; value: number }[] =
    start === 0
      ? [{ keyTime: 0, value: 1 }]
      : [
          { keyTime: 0, value: 0 },
          { keyTime: start, value: 1 },
        ]

  if (nextFrame !== -1) {
    points.push({ keyTime: keyTimes[nextFrame] ?? 1, value: 0 })
  }

  return discreteAnimation({
    attributeName: 'opacity',
    values: points.map((point) => point.value),
    keyTimes: points.map((point) => point.keyTime),
    durSeconds: timeline.totalSeconds,
  })
}

function renderCaret(options: {
  timeline: TypingTimeline
  keyTimes: number[]
}): string {
  const { timeline, keyTimes } = options
  const positions = timeline.frames.map((frame) =>
    round(CARD_PADDING_X + typedWidth(frame.charCount) + CARET_GAP, 2),
  )

  return [
    `<rect x="${round(restingCaretEdge() + CARET_GAP, 2)}" y="${HERO_BASELINE_Y - CARET_HEIGHT + 2}" width="${CARET_WIDTH}" height="${CARET_HEIGHT}" rx="2" fill="${COLORS.accentAlt}" opacity="0.85">`,
    discreteAnimation({
      attributeName: 'x',
      values: positions,
      keyTimes,
      durSeconds: timeline.totalSeconds,
    }),
    `<animate attributeName="opacity" values="0.85;0.1" keyTimes="0;0.5" calcMode="discrete" dur="${CARET_BLINK_SECONDS}s" repeatCount="indefinite" />`,
    '</rect>',
  ].join('')
}

function renderShutter(options: {
  timeline: TypingTimeline
  keyTimes: number[]
}): string {
  const { timeline, keyTimes } = options
  const rightEdge = CARD_WIDTH.FULL - CARD_PADDING_X
  const edges = timeline.frames.map((frame) =>
    round(CARD_PADDING_X + typedWidth(frame.charCount), 2),
  )
  const restEdge = restingCaretEdge()

  return [
    `<rect x="${restEdge}" y="${SHUTTER_TOP_Y}" width="${round(rightEdge - restEdge, 2)}" height="${SHUTTER_HEIGHT}" fill="${COLORS.background}">`,
    discreteAnimation({
      attributeName: 'x',
      values: edges,
      keyTimes,
      durSeconds: timeline.totalSeconds,
    }),
    discreteAnimation({
      attributeName: 'width',
      values: edges.map((edge) => round(rightEdge - edge, 2)),
      keyTimes,
      durSeconds: timeline.totalSeconds,
    }),
    '</rect>',
  ].join('')
}

function renderSubtitle(): string {
  const spans = SUBTITLE_SEGMENTS.map((segment) => {
    const opacity =
      segment.opacity === undefined ? '' : ` opacity="${segment.opacity}"`
    return `<tspan fill="${COLORS[segment.fill]}"${opacity}>${escapeXml(segment.text)}</tspan>`
  })

  return svgText({
    content: spans.join(''),
    x: CARD_PADDING_X,
    y: SUBTITLE_BASELINE_Y,
    size: FONT_SIZE.value,
    letterSpacing: 0.6,
    raw: true,
  })
}

function discreteAnimation(options: {
  attributeName: string
  values: number[]
  keyTimes: number[]
  durSeconds: number
}): string {
  const { attributeName, values, keyTimes, durSeconds } = options
  return `<animate attributeName="${attributeName}" values="${values.join(';')}" keyTimes="${keyTimes.join(';')}" calcMode="discrete" dur="${round(durSeconds, 3)}s" repeatCount="indefinite" />`
}

function typedWidth(charCount: number): number {
  return charCount * HERO_SIZE * MONO_WIDTH_RATIO
}

/** Where the caret sits in renderers that ignore SMIL: first line fully typed. */
function restingCaretEdge(): number {
  return round(CARD_PADDING_X + typedWidth(TYPED_LINES[0]?.length ?? 0), 2)
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function buildAriaLabel(): string {
  const subtitle = SUBTITLE_SEGMENTS.map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(' ')
  return `${TYPED_LINES.join('. ')}. ${subtitle}`
}
