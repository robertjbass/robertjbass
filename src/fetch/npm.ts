const DOWNLOADS_RANGE_URL = 'https://api.npmjs.org/downloads/range'
const VELOCITY_WINDOW_DAYS = 90
/** The range endpoint silently clamps anything wider than 18 months. */
const RANGE_CHUNK_DAYS = 540
/** npm has no download counts before this day. */
const EARLIEST_DOWNLOAD_DAY = '2015-01-10'
/** Two empty chunks back to back means the package predates nothing further. */
const EMPTY_CHUNK_LIMIT = 2
const MS_PER_DAY = 86_400_000

const PACKAGES = [
  'spindb',
  'hostdb',
  'layerbase',
  'ask-chat',
  'lpgp',
  'nodepm-ui',
  'payload-client-query',
  'dotport',
  'redis-view',
  'dbsdk',
  '@layerbase/secrets',
]

export type NpmPackageDownloads = {
  name: string
  allTime: number
  last90Days: number
  /** Mean downloads per day across the 90-day window. */
  dailyAverage: number
  /** Straight-line 12-month projection from the 90-day window. */
  projectedYear: number
}

export type NpmData = {
  packages: NpmPackageDownloads[]
  totalAllTime: number
  totalLast90Days: number
  totalDailyAverage: number
  totalProjectedYear: number
  windowDays: number
}

export async function fetchNpmData(): Promise<NpmData> {
  const today = toIsoDay(new Date())
  const windowStart = shiftDay({
    day: today,
    days: -(VELOCITY_WINDOW_DAYS - 1),
  })

  const packages = await Promise.all(
    PACKAGES.map(async (name) => {
      const history = await fetchPackageHistory({ name, today })
      const allTime = sumDownloads(history)
      const last90Days = sumDownloads(
        history.filter((entry) => entry.day >= windowStart),
      )
      const dailyAverage = last90Days / VELOCITY_WINDOW_DAYS

      return {
        name,
        allTime,
        last90Days,
        dailyAverage: Math.round(dailyAverage * 10) / 10,
        projectedYear: Math.round(dailyAverage * 365),
      }
    }),
  )

  const sorted = [...packages].sort(
    (left, right) => right.allTime - left.allTime,
  )
  const totalLast90Days = sorted.reduce(
    (total, entry) => total + entry.last90Days,
    0,
  )
  const totalDailyAverage = totalLast90Days / VELOCITY_WINDOW_DAYS

  return {
    packages: sorted,
    totalAllTime: sorted.reduce((total, entry) => total + entry.allTime, 0),
    totalLast90Days,
    totalDailyAverage: Math.round(totalDailyAverage * 10) / 10,
    totalProjectedYear: Math.round(totalDailyAverage * 365),
    windowDays: VELOCITY_WINDOW_DAYS,
  }
}

type DailyDownload = {
  day: string
  downloads: number
}

async function fetchPackageHistory(options: {
  name: string
  today: string
}): Promise<DailyDownload[]> {
  const { name, today } = options
  const history: DailyDownload[] = []
  let end = today
  let emptyChunks = 0

  while (end >= EARLIEST_DOWNLOAD_DAY && emptyChunks < EMPTY_CHUNK_LIMIT) {
    const start = maxDay(
      EARLIEST_DOWNLOAD_DAY,
      shiftDay({ day: end, days: -(RANGE_CHUNK_DAYS - 1) }),
    )
    const chunk = await fetchDownloadRange({ name, start, end })
    history.push(...chunk)
    emptyChunks = sumDownloads(chunk) === 0 ? emptyChunks + 1 : 0

    if (start === EARLIEST_DOWNLOAD_DAY) break
    end = shiftDay({ day: start, days: -1 })
  }

  return history
}

async function fetchDownloadRange(options: {
  name: string
  start: string
  end: string
}): Promise<DailyDownload[]> {
  const { name, start, end } = options
  const url = `${DOWNLOADS_RANGE_URL}/${start}:${end}/${name}`

  const response = await fetch(url, {
    headers: { 'user-agent': 'robertjbass-profile' },
  })

  if (response.status === 404) return []
  if (!response.ok) {
    throw new Error(
      `npm downloads ${response.status} for ${name}. Verify the package name is published: https://www.npmjs.com/package/${name}`,
    )
  }

  const payload = (await response.json()) as {
    downloads?: DailyDownload[]
    error?: string
  }
  if (payload.error) {
    throw new Error(
      `npm downloads rejected ${start}:${end} for ${name} - ${payload.error}.`,
    )
  }

  return payload.downloads ?? []
}

function sumDownloads(entries: DailyDownload[]): number {
  return entries.reduce((total, entry) => total + entry.downloads, 0)
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function shiftDay(options: { day: string; days: number }): string {
  const { day, days } = options
  return toIsoDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY))
}

function maxDay(left: string, right: string): string {
  return left > right ? left : right
}
