const PRIMARY_URL = 'https://registry.layerbase.host/releases.json'
const FALLBACK_URL =
  'https://raw.githubusercontent.com/robertjbass/hostdb/main/releases.json'

export type EngineRelease = {
  name: string
  /** Highest stable version, falling back to the highest prerelease. */
  latestVersion: string
  /** Highest prerelease version when one is newer than `latestVersion`. */
  latestPrerelease: string | null
  releasedAt: string | null
  versionCount: number
  platforms: string[]
}

export type EnginesData = {
  source: string
  repository: string | null
  engineCount: number
  versionCount: number
  engines: EngineRelease[]
}

type ReleasesManifest = {
  repository?: string
  databases?: Record<
    string,
    Record<
      string,
      {
        version?: string
        releasedAt?: string
        platforms?: Record<string, unknown>
      }
    >
  >
}

export async function fetchEnginesData(): Promise<EnginesData> {
  const { manifest, source } = await loadManifest()
  const databases = manifest.databases ?? {}

  const engines: EngineRelease[] = Object.entries(databases)
    .map(([name, versions]) => {
      const entries = Object.entries(versions)
      const ordered = entries
        .map(([version, release]) => ({ version, release }))
        .sort((left, right) => compareVersions(right.version, left.version))

      const stable = ordered.find((entry) => !isPrerelease(entry.version))
      const newest = ordered[0]
      const latest = stable ?? newest

      return {
        name,
        latestVersion: latest?.version ?? 'unknown',
        latestPrerelease:
          newest && stable && newest.version !== stable.version
            ? newest.version
            : null,
        releasedAt: latest?.release.releasedAt ?? null,
        versionCount: entries.length,
        platforms: Object.keys(latest?.release.platforms ?? {}).sort(),
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))

  return {
    source,
    repository: manifest.repository ?? null,
    engineCount: engines.length,
    versionCount: engines.reduce(
      (total, engine) => total + engine.versionCount,
      0,
    ),
    engines,
  }
}

async function loadManifest(): Promise<{
  manifest: ReleasesManifest
  source: string
}> {
  for (const url of [PRIMARY_URL, FALLBACK_URL]) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'robertjbass-profile' },
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const manifest = (await response.json()) as ReleasesManifest
      if (!manifest.databases) throw new Error('missing `databases` key')
      return { manifest, source: url }
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error)
      console.warn(`engines: ${url} unavailable (${reason})`)
    }
  }

  throw new Error(
    `Could not load releases.json from ${PRIMARY_URL} or ${FALLBACK_URL}. Check network access and that the hostdb registry is up.`,
  )
}

function isPrerelease(version: string): boolean {
  return version.includes('-')
}

function compareVersions(left: string, right: string): number {
  const leftParts = splitVersion(left)
  const rightParts = splitVersion(right)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const a = leftParts[index] ?? 0
    const b = rightParts[index] ?? 0
    if (a !== b) return a - b
  }

  return left.localeCompare(right)
}

function splitVersion(version: string): number[] {
  return version
    .split('-')[0]!
    .split('.')
    .map((segment) => Number.parseInt(segment, 10) || 0)
}
