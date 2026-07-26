const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql'
const DEFAULT_LOGIN = 'robertjbass'
const LAYERBASE_ORG = 'Layerbase-LLC'
const MIN_CALENDAR_YEARS = 2
const MAX_CALENDAR_YEARS = 15
/** Covers the full 365-day window the commit uptime card reports on, plus today. */
const DAILY_COUNT_WINDOW = 366

const EXCLUDED_LANGUAGE_REPOS = new Set([
  'IAmTimCCourses',
  'place-tracking-app',
  'bbass-co',
  'backslash',
  'express-todo',
  'react_crash_todo',
  'react-currency-converter',
  'svelte-jotpad',
  'vue-product-app',
  'react-class-component-ref',
  'fwd-gg',
  'electron-screen-recording-vue',
  'jsMachineLearningTextColor',
])

const EXCLUDED_LANGUAGES = new Set(['Pug', 'EJS', 'Jade', 'SCSS', 'PLpgSQL'])

const FEATURED_REPOS = [
  'robertjbass/spindb',
  'robertjbass/hostdb',
  'robertjbass/hackerlab',
  'robertjbass/dotport',
  'robertjbass/nodepm-ui',
  'robertjbass/lpgp',
  'robertjbass/ask-chat',
  'robertjbass/hey-chatgpt',
  'robertjbass/gh-data-scraper',
  'payloadcms/payload',
  'MariaDB4j/MariaDB4j',
  'PostHog/duckgres',
]

export type GraphqlRequest = {
  query: string
  variables?: Record<string, unknown>
}

export function getGithubToken(): string {
  const token = process.env.GITHUB_TOKEN ?? process.env.PROFILE_PAT
  if (!token) {
    throw new Error(
      'Missing GitHub token. Set GITHUB_TOKEN or PROFILE_PAT (locally: GITHUB_TOKEN=$(gh auth token) pnpm generate).',
    )
  }
  return token
}

export async function githubGraphql<T>(request: GraphqlRequest): Promise<T> {
  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      authorization: `bearer ${getGithubToken()}`,
      'content-type': 'application/json',
      'user-agent': 'robertjbass-profile',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      `GitHub GraphQL ${response.status}: ${detail.slice(0, 300)}. Check that the token is valid and has read:user + repo scopes.`,
    )
  }

  const payload = (await response.json()) as {
    data?: T
    errors?: { message: string }[]
  }

  if (payload.errors?.length) {
    throw new Error(
      `GitHub GraphQL errors: ${payload.errors.map((entry) => entry.message).join('; ')}`,
    )
  }
  if (!payload.data) throw new Error('GitHub GraphQL returned no data')

  return payload.data
}

export type ContributionDay = {
  date: string
  count: number
}

export type LanguageUsage = {
  name: string
  bytes: number
  share: number
  color: string | null
  repoCount: number
}

export type RepoSummary = {
  nameWithOwner: string
  name: string
  owner: string
  description: string | null
  url: string
  stars: number
  forks: number
  language: { name: string; color: string | null } | null
}

export type GithubData = {
  login: string
  followers: number
  /** Owner-affiliated repositories, forks and private included. */
  repoCount: number
  publicRepoCount: number
  layerbaseRepoCount: number
  /** `repoCount` plus the Layerbase-LLC org repositories. */
  totalRepoCount: number
  currentStreakDays: number
  streakStartDate: string | null
  lastZeroDate: string | null
  totalContributionsPastYear: number
  /** Sum over the full fetched calendar, back to account creation. */
  totalContributionsAllTime: number
  longestStreakDays: number
  longestStreakStartDate: string | null
  longestStreakEndDate: string | null
  dailyCounts: ContributionDay[]
  languages: LanguageUsage[]
  repos: RepoSummary[]
}

export async function fetchGithubData(
  options: { login?: string } = {},
): Promise<GithubData> {
  const login = options.login ?? DEFAULT_LOGIN

  const profile = await fetchProfileCounts({ login })
  const [calendar, languages, repos] = await Promise.all([
    fetchContributionCalendar({
      login,
      years: resolveCalendarYears(profile.createdAt),
    }),
    fetchLanguageUsage({ login }),
    fetchFeaturedRepos(),
  ])

  const streak = computeStreak(calendar.days)

  return {
    login,
    followers: profile.followers,
    repoCount: profile.repoCount,
    publicRepoCount: profile.publicRepoCount,
    layerbaseRepoCount: profile.layerbaseRepoCount,
    totalRepoCount: profile.repoCount + profile.layerbaseRepoCount,
    currentStreakDays: streak.currentStreakDays,
    streakStartDate: streak.streakStartDate,
    lastZeroDate: streak.lastZeroDate,
    totalContributionsPastYear: calendar.totalPastYear,
    totalContributionsAllTime: calendar.totalAllTime,
    longestStreakDays: streak.longestStreakDays,
    longestStreakStartDate: streak.longestStreakStartDate,
    longestStreakEndDate: streak.longestStreakEndDate,
    dailyCounts: calendar.days.slice(-DAILY_COUNT_WINDOW),
    languages,
    repos,
  }
}

type ProfileCounts = {
  followers: number
  repoCount: number
  publicRepoCount: number
  layerbaseRepoCount: number
  createdAt: string
}

async function fetchProfileCounts(options: {
  login: string
}): Promise<ProfileCounts> {
  const data = await githubGraphql<{
    user: {
      followers: { totalCount: number }
      owned: { totalCount: number }
      publicOwned: { totalCount: number }
      createdAt: string
    }
    organization: { repositories: { totalCount: number } } | null
  }>({
    query: `
      query ProfileCounts($login: String!, $org: String!) {
        user(login: $login) {
          createdAt
          followers { totalCount }
          owned: repositories(ownerAffiliations: OWNER) { totalCount }
          publicOwned: repositories(
            ownerAffiliations: OWNER
            privacy: PUBLIC
          ) { totalCount }
        }
        organization(login: $org) {
          repositories(ownerAffiliations: OWNER) { totalCount }
        }
      }
    `,
    variables: { login: options.login, org: LAYERBASE_ORG },
  })

  return {
    followers: data.user.followers.totalCount,
    repoCount: data.user.owned.totalCount,
    publicRepoCount: data.user.publicOwned.totalCount,
    layerbaseRepoCount: data.organization?.repositories.totalCount ?? 0,
    createdAt: data.user.createdAt,
  }
}

/** Enough one-year calendar windows to reach back to account creation. */
function resolveCalendarYears(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageYears = Math.ceil(ageMs / (365 * 86_400_000))
  return Math.min(MAX_CALENDAR_YEARS, Math.max(MIN_CALENDAR_YEARS, ageYears))
}

type CalendarWindow = {
  totalContributions: number
  weeks: { contributionDays: { date: string; contributionCount: number }[] }[]
}

type CalendarResult = {
  days: ContributionDay[]
  totalPastYear: number
  totalAllTime: number
}

async function fetchContributionCalendar(options: {
  login: string
  years: number
}): Promise<CalendarResult> {
  const today = startOfUtcDay(new Date())
  const ranges = buildYearRanges({ today, years: options.years })

  const windows = await Promise.all(
    ranges.map(async (range) => {
      const data = await githubGraphql<{
        user: {
          contributionsCollection: { contributionCalendar: CalendarWindow }
        }
      }>({
        query: `
          query Calendar($login: String!, $from: DateTime!, $to: DateTime!) {
            user(login: $login) {
              contributionsCollection(from: $from, to: $to) {
                contributionCalendar {
                  totalContributions
                  weeks {
                    contributionDays { date contributionCount }
                  }
                }
              }
            }
          }
        `,
        variables: {
          login: options.login,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      })
      return data.user.contributionsCollection.contributionCalendar
    }),
  )

  const todayIso = toIsoDate(today)
  const byDate = new Map<string, number>()
  for (const window of windows) {
    for (const week of window.weeks) {
      for (const day of week.contributionDays) {
        if (day.date > todayIso) continue
        byDate.set(day.date, day.contributionCount)
      }
    }
  }

  const days = [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }))

  return {
    days,
    totalPastYear: windows.at(-1)?.totalContributions ?? 0,
    totalAllTime: days.reduce((total, day) => total + day.count, 0),
  }
}

function buildYearRanges(options: { today: Date; years: number }): {
  from: Date
  to: Date
}[] {
  const { today, years } = options
  const ranges: { from: Date; to: Date }[] = []

  for (let index = years - 1; index >= 0; index -= 1) {
    const to = addDays(today, -365 * index)
    const from = addDays(to, -364)
    ranges.push({ from: startOfUtcDay(from), to: endOfUtcDay(to) })
  }

  return ranges
}

type StreakResult = {
  currentStreakDays: number
  streakStartDate: string | null
  lastZeroDate: string | null
  longestStreakDays: number
  longestStreakStartDate: string | null
  longestStreakEndDate: string | null
}

export function computeStreak(days: ContributionDay[]): StreakResult {
  if (days.length === 0) {
    return {
      currentStreakDays: 0,
      streakStartDate: null,
      lastZeroDate: null,
      longestStreakDays: 0,
      longestStreakStartDate: null,
      longestStreakEndDate: null,
    }
  }

  let cursor = days.length - 1
  const lastDay = days[cursor]
  if (lastDay && lastDay.count === 0) cursor -= 1

  let currentStreakDays = 0
  let lastZeroDate: string | null = null
  let streakStartDate: string | null = null

  for (let index = cursor; index >= 0; index -= 1) {
    const day = days[index]
    if (!day) break
    if (day.count === 0) {
      lastZeroDate = day.date
      break
    }
    currentStreakDays += 1
    streakStartDate = day.date
  }

  let longestStreakDays = 0
  let longestStreakStartDate: string | null = null
  let longestStreakEndDate: string | null = null
  let run = 0
  let runStartDate: string | null = null
  for (const day of days) {
    if (day.count > 0) {
      if (run === 0) runStartDate = day.date
      run += 1
      if (run > longestStreakDays) {
        longestStreakDays = run
        longestStreakStartDate = runStartDate
        longestStreakEndDate = day.date
      }
    } else {
      run = 0
      runStartDate = null
    }
  }

  return {
    currentStreakDays,
    streakStartDate,
    lastZeroDate,
    longestStreakDays,
    longestStreakStartDate,
    longestStreakEndDate,
  }
}

type LanguageRepoNode = {
  name: string
  languages: {
    edges: { size: number; node: { name: string; color: string | null } }[]
  }
}

async function fetchLanguageUsage(options: {
  login: string
}): Promise<LanguageUsage[]> {
  const totals = new Map<
    string,
    { bytes: number; color: string | null; repoCount: number }
  >()
  let cursor: string | null = null

  while (true) {
    const data: {
      user: {
        repositories: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null }
          nodes: LanguageRepoNode[]
        }
      }
    } = await githubGraphql({
      query: `
        query Languages($login: String!, $cursor: String) {
          user(login: $login) {
            repositories(
              ownerAffiliations: OWNER
              isFork: false
              first: 100
              after: $cursor
            ) {
              pageInfo { hasNextPage endCursor }
              nodes {
                name
                languages(first: 12, orderBy: { field: SIZE, direction: DESC }) {
                  edges { size node { name color } }
                }
              }
            }
          }
        }
      `,
      variables: { login: options.login, cursor },
    })

    for (const repo of data.user.repositories.nodes) {
      if (EXCLUDED_LANGUAGE_REPOS.has(repo.name)) continue
      for (const edge of repo.languages.edges) {
        if (EXCLUDED_LANGUAGES.has(edge.node.name)) continue
        const existing = totals.get(edge.node.name)
        totals.set(edge.node.name, {
          bytes: (existing?.bytes ?? 0) + edge.size,
          color: existing?.color ?? edge.node.color,
          repoCount: (existing?.repoCount ?? 0) + 1,
        })
      }
    }

    if (!data.user.repositories.pageInfo.hasNextPage) break
    cursor = data.user.repositories.pageInfo.endCursor
    if (!cursor) break
  }

  const totalBytes = [...totals.values()].reduce(
    (sum, entry) => sum + entry.bytes,
    0,
  )

  return [...totals.entries()]
    .map(([name, entry]) => ({
      name,
      bytes: entry.bytes,
      share: totalBytes === 0 ? 0 : entry.bytes / totalBytes,
      color: entry.color,
      repoCount: entry.repoCount,
    }))
    .sort((left, right) => right.bytes - left.bytes)
}

async function fetchFeaturedRepos(): Promise<RepoSummary[]> {
  const fragments = FEATURED_REPOS.map((fullName, index) => {
    const [owner, name] = fullName.split('/')
    return `
      repo${index}: repository(owner: "${owner}", name: "${name}") {
        ...repoFields
      }
    `
  })

  const data = await githubGraphql<
    Record<
      string,
      {
        nameWithOwner: string
        name: string
        owner: { login: string }
        description: string | null
        url: string
        stargazerCount: number
        forkCount: number
        primaryLanguage: { name: string; color: string | null } | null
      } | null
    >
  >({
    query: `
      query FeaturedRepos {
        ${fragments.join('\n')}
      }
      fragment repoFields on Repository {
        nameWithOwner
        name
        owner { login }
        description
        url
        stargazerCount
        forkCount
        primaryLanguage { name color }
      }
    `,
  })

  return FEATURED_REPOS.map((_, index) => data[`repo${index}`])
    .filter((repo): repo is NonNullable<typeof repo> => Boolean(repo))
    .map((repo) => ({
      nameWithOwner: repo.nameWithOwner,
      name: repo.name,
      owner: repo.owner.login,
      description: repo.description,
      url: repo.url,
      stars: repo.stargazerCount,
      forks: repo.forkCount,
      language: repo.primaryLanguage,
    }))
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  )
}

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      0,
    ),
  )
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
