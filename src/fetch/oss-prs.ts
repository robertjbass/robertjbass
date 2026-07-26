const SEARCH_URL = 'https://api.github.com/search/issues'
const EXTERNAL_QUERY =
  'is:pr is:merged author:robertjbass -user:robertjbass -org:Layerbase-LLC -org:efficientapp'
const SHOWCASE_REPOS = ['robertjbass/spindb', 'robertjbass/hostdb']
const EXCLUDED_REPOS = new Set([
  'Peddle/dewey-electron-upgrade',
  'm-oniqu3/finest-and-co',
])
const RECENT_TITLE_LIMIT = 3
const PAGE_SIZE = 100
const MAX_PAGES = 5

export type OssPrRepo = {
  repo: string
  url: string
  prCount: number
  recentTitles: string[]
}

export type OssPrData = {
  totalMergedPrs: number
  repoCount: number
  repos: OssPrRepo[]
}

type SearchItem = {
  title: string
  html_url: string
  repository_url: string
  closed_at: string | null
  updated_at: string
}

export async function fetchOssPrs(): Promise<OssPrData> {
  const showcaseQuery = `is:pr is:merged author:robertjbass ${SHOWCASE_REPOS.map(
    (repo) => `repo:${repo}`,
  ).join(' ')}`

  const [externalItems, showcaseItems] = await Promise.all([
    runSearch(EXTERNAL_QUERY),
    runSearch(showcaseQuery),
  ])

  const byRepo = new Map<string, SearchItem[]>()
  for (const item of [...externalItems, ...showcaseItems]) {
    const repo = item.repository_url.replace(
      'https://api.github.com/repos/',
      '',
    )
    if (EXCLUDED_REPOS.has(repo)) continue
    const bucket = byRepo.get(repo)
    if (bucket) bucket.push(item)
    else byRepo.set(repo, [item])
  }

  const repos: OssPrRepo[] = [...byRepo.entries()]
    .map(([repo, repoItems]) => ({
      repo,
      url: `https://github.com/${repo}`,
      prCount: repoItems.length,
      recentTitles: [...repoItems]
        .sort((left, right) => recency(right) - recency(left))
        .slice(0, RECENT_TITLE_LIMIT)
        .map((item) => item.title),
    }))
    .sort(
      (left, right) =>
        right.prCount - left.prCount || left.repo.localeCompare(right.repo),
    )

  return {
    totalMergedPrs: repos.reduce((sum, entry) => sum + entry.prCount, 0),
    repoCount: repos.length,
    repos,
  }
}

async function runSearch(query: string): Promise<SearchItem[]> {
  const items: SearchItem[] = []
  let totalCount = 0

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(SEARCH_URL)
    url.searchParams.set('q', query)
    url.searchParams.set('per_page', String(PAGE_SIZE))
    url.searchParams.set('page', String(page))
    url.searchParams.set('sort', 'updated')
    url.searchParams.set('order', 'desc')

    const response = await fetch(url, { headers: buildHeaders() })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(
        `GitHub search ${response.status}: ${detail.slice(0, 300)}. Search requires an authenticated token (GITHUB_TOKEN or PROFILE_PAT).`,
      )
    }

    const payload = (await response.json()) as {
      total_count: number
      items: SearchItem[]
    }
    totalCount = payload.total_count
    items.push(...payload.items)

    if (items.length >= totalCount || payload.items.length < PAGE_SIZE) break
  }

  return items
}

function recency(item: SearchItem): number {
  return new Date(item.closed_at ?? item.updated_at).getTime()
}

function buildHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN ?? process.env.PROFILE_PAT
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'robertjbass-profile',
  }
  if (token) headers.authorization = `bearer ${token}`
  return headers
}
