import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { renderActivityGraph } from './cards/activity-graph.ts'
import { renderEngineRoster } from './cards/engine-roster.ts'
import { renderHeader } from './cards/header.ts'
import { renderLanguages } from './cards/languages.ts'
import { renderMilestones } from './cards/milestones.ts'
import { renderNpmDownloads } from './cards/npm-downloads.ts'
import { renderOssScoreboard } from './cards/oss-scoreboard.ts'
import { renderAllRepoPins } from './cards/repo-pin.ts'
import { renderStats } from './cards/stats.ts'
import { renderStreakStatus } from './cards/streak-status.ts'
import { fetchEnginesData, type EnginesData } from './fetch/engines.ts'
import { fetchGithubData, type GithubData } from './fetch/github.ts'
import { fetchNpmData, type NpmData } from './fetch/npm.ts'
import { fetchOssPrs, type OssPrData } from './fetch/oss-prs.ts'

const OUTPUT_DIR = resolve(import.meta.dirname, '..', 'output')
const README_PATH = resolve(import.meta.dirname, '..', 'README.md')
const DATA_FILE_NAME = 'profile-data.json'
const PIN_REFERENCE_PATTERN = /pin-[a-z0-9._-]+\.svg/g

export type ProfileDataWarning = {
  slice: 'github' | 'ossPrs' | 'npm' | 'engines'
  message: string
}

export type ProfileData = {
  generatedAt: string
  github: GithubData | null
  ossPrs: OssPrData | null
  npm: NpmData | null
  engines: EnginesData | null
  /** One entry per fetcher that failed; the slice is null when present here. */
  warnings: ProfileDataWarning[]
}

export async function fetchAll(): Promise<ProfileData> {
  const warnings: ProfileDataWarning[] = []

  const [github, ossPrs, npm, engines] = await Promise.all([
    failSoft({ slice: 'github', warnings, run: fetchGithubData }),
    failSoft({ slice: 'ossPrs', warnings, run: fetchOssPrs }),
    failSoft({ slice: 'npm', warnings, run: fetchNpmData }),
    failSoft({ slice: 'engines', warnings, run: fetchEnginesData }),
  ])

  return {
    generatedAt: new Date().toISOString(),
    github,
    ossPrs,
    npm,
    engines,
    warnings,
  }
}

async function failSoft<T>(options: {
  slice: ProfileDataWarning['slice']
  warnings: ProfileDataWarning[]
  run: () => Promise<T>
}): Promise<T | null> {
  const { slice, warnings, run } = options
  try {
    return await run()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`warning: ${slice} fetch failed - ${message}`)
    warnings.push({ slice, message })
    return null
  }
}

/* ------------------------------------------------------------------ *
 * CARD RENDERING
 *
 * Each card module lives in `src/cards/<card-name>.ts`, imports its
 * chrome from `src/theme.ts` (`cardFrame`, `svgText`, `separator`,
 * `formatNumber`) and exports a pure `ProfileData -> string` renderer.
 * Register it in `CARD_RENDERERS`; `main()` writes each result into
 * `output/<fileName>`.
 * ------------------------------------------------------------------ */

export type CardRenderer = {
  fileName: string
  render: (data: ProfileData) => string
}

export const CARD_RENDERERS: CardRenderer[] = [
  { fileName: 'header.svg', render: () => renderHeader() },
  { fileName: 'streak-status.svg', render: renderStreakStatus },
  { fileName: 'stats.svg', render: renderStats },
  { fileName: 'milestones.svg', render: renderMilestones },
  { fileName: 'npm-downloads.svg', render: renderNpmDownloads },
  { fileName: 'oss-scoreboard.svg', render: renderOssScoreboard },
  { fileName: 'engine-roster.svg', render: renderEngineRoster },
  { fileName: 'languages.svg', render: renderLanguages },
  { fileName: 'activity-graph.svg', render: renderActivityGraph },
]

/** Everything not written by this run is stale and must not reach the branch. */
async function pruneOutput(options: {
  outputDir: string
  keep: Iterable<string>
}): Promise<void> {
  const { outputDir, keep } = options
  const allowed = new Set(keep)

  for (const entry of await readdir(outputDir)) {
    if (allowed.has(entry)) continue
    await rm(resolve(outputDir, entry), { force: true, recursive: true })
  }
}

async function findMissingReadmePins(options: {
  written: string[]
}): Promise<string[]> {
  const readme = await readFile(README_PATH, 'utf8')
  const referenced = new Set(readme.match(PIN_REFERENCE_PATTERN) ?? [])
  const rendered = new Set(options.written)
  return [...referenced].filter((fileName) => !rendered.has(fileName))
}

async function writeCards(options: {
  data: ProfileData
  outputDir: string
}): Promise<{ written: string[]; failed: string[] }> {
  const { data, outputDir } = options
  const written: string[] = []
  const failed: string[] = []

  for (const card of CARD_RENDERERS) {
    try {
      const svg = card.render(data)
      await writeFile(resolve(outputDir, card.fileName), svg, 'utf8')
      written.push(card.fileName)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`warning: skipped ${card.fileName} - ${message}`)
      failed.push(card.fileName)
    }
  }

  try {
    for (const pin of renderAllRepoPins(data)) {
      try {
        await writeFile(resolve(outputDir, pin.fileName), pin.svg, 'utf8')
        written.push(pin.fileName)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`warning: skipped ${pin.fileName} - ${message}`)
        failed.push(pin.fileName)
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`warning: skipped all repo pins - ${message}`)
    const existing = await readdir(outputDir)
    failed.push(...existing.filter((entry) => entry.startsWith('pin-')))
  }

  return { written, failed }
}

/* ------------------------------------------------------------------ */

function parseSnapshotPath(argv: string[]): string | null {
  const flag = argv.find((entry) => entry.startsWith('--snapshot'))
  if (!flag) return null

  const inline = flag.split('=')[1]
  if (inline) return resolve(inline)

  const next = argv[argv.indexOf(flag) + 1]
  if (!next || next.startsWith('--')) {
    throw new Error('Missing value for --snapshot. Use --snapshot=<path.json>')
  }
  return resolve(next)
}

async function main(): Promise<void> {
  const snapshotPath = parseSnapshotPath(process.argv.slice(2))
  const data = await fetchAll()

  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(
    resolve(OUTPUT_DIR, DATA_FILE_NAME),
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8',
  )

  if (snapshotPath) {
    await mkdir(dirname(snapshotPath), { recursive: true })
    await writeFile(snapshotPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    console.log(`snapshot: ${snapshotPath}`)
  }

  const { written, failed } = await writeCards({ data, outputDir: OUTPUT_DIR })
  const keptSnapshot =
    snapshotPath && dirname(snapshotPath) === OUTPUT_DIR
      ? [basename(snapshotPath)]
      : []

  await pruneOutput({
    outputDir: OUTPUT_DIR,
    keep: [...written, ...failed, ...keptSnapshot, DATA_FILE_NAME],
  })

  const missingPins = await findMissingReadmePins({ written })
  for (const fileName of missingPins) {
    console.warn(
      `warning: README.md references ${fileName}, which no renderer produced. Update the README or FEATURED_REPOS in src/fetch/github.ts.`,
    )
  }

  console.log(
    [
      `generated: ${data.generatedAt}`,
      `streak: ${data.github?.currentStreakDays ?? 'n/a'} days`,
      `repos: ${data.github?.repoCount ?? 'n/a'} owned + ${data.github?.layerbaseRepoCount ?? 'n/a'} org`,
      `npm all-time: ${data.npm?.totalAllTime ?? 'n/a'}`,
      `oss merged prs: ${data.ossPrs?.totalMergedPrs ?? 'n/a'}`,
      `engines: ${data.engines?.engineCount ?? 'n/a'}`,
      `svgs written: ${written.length}`,
      `svgs skipped: ${failed.length}`,
      `readme pins missing: ${missingPins.length}`,
      `warnings: ${data.warnings.length}`,
    ].join('\n'),
  )

  const githubFailed = data.warnings.some(
    (warning) => warning.slice === 'github',
  )
  if (written.length === 0 || githubFailed) process.exitCode = 1
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  await main()
}
