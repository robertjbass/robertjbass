# Repository Guidelines

This repository is Bob Bass's GitHub profile README plus the self-hosted generator that renders every card shown on it. There are no third-party widget services: all SVGs are produced here from live data and published to an orphan `output` branch.

## Project Structure & Module Organization

- `README.md` is the published GitHub profile content. Every image points at `https://raw.githubusercontent.com/robertjbass/robertjbass/output/<file>.svg`.
- `src/index.ts` is the entry point: fetches all data slices, writes `output/profile-data.json`, then renders and writes every card.
- `src/theme.ts` owns the design system. Palette, font stacks, card widths, spacing tokens, and the shared helpers (`cardFrame`, `svgText`, `separator`, `prompt`, `formatNumber`, `truncate`, `escapeXml`, `resolveColor`). Card files must never hardcode a palette value.
- `src/fetch/` holds one module per data source, each exporting its own data type:
  - `github.ts` -> `GithubData` (streak, contributions, repo counts, languages, featured repos) via the GraphQL API.
  - `oss-prs.ts` -> `OssPrData` (merged PRs into repos Bob does not own).
  - `npm.ts` -> `NpmData` (per-package download totals and velocity).
  - `engines.ts` -> `EnginesData` (Layerbase engine roster from `registry.layerbase.host/releases.json`).
- `src/cards/` holds one module per card. Each exports a pure `render*(data: ProfileData): string` returning a complete standalone `<svg>`.
- `todos/TODOS.md` tracks planned enhancements. `todos/README-OTHER.md` holds alternate README content.
- `output/` is generated and gitignored on `main`; it is the entire content of the `output` branch.

## Build, Test, and Development Commands

- `pnpm install` - install dependencies (pnpm only; `onlyBuiltDependencies` must keep `esbuild` so `tsx` works).
- `GITHUB_TOKEN=$(gh auth token) pnpm generate` - fetch live data and write every SVG plus `profile-data.json` into `output/`. Degraded slices are warnings only so the run still publishes; it exits non-zero only when nothing was written or the GitHub slice itself failed.
- `pnpm generate -- --snapshot=<path.json>` - additionally write the fetched data to an arbitrary path, for offline card iteration.
- `pnpm exec tsc --noEmit` - type-check. Must be clean.
- `pnpm format` - Prettier over the repo.

There is no build step. TypeScript runs directly through `tsx`, and imports carry explicit `.ts` extensions (`allowImportingTsExtensions` is on).

## Cards

Registered in `CARD_RENDERERS` in `src/index.ts` and written to `output/`:

| File | Width | Renderer |
| --- | --- | --- |
| `header.svg` | 840 | `renderHeader` (data-free, animated typing intro) |
| `streak-status.svg` | 840 | `renderStreakStatus` |
| `stats.svg` | 410 | `renderStats` |
| `milestones.svg` | 410 | `renderMilestones` |
| `npm-downloads.svg` | 840 | `renderNpmDownloads` |
| `oss-scoreboard.svg` | 410 | `renderOssScoreboard` |
| `engine-roster.svg` | 840 | `renderEngineRoster` |
| `languages.svg` | 410 | `renderLanguages` |
| `activity-graph.svg` | 840 | `renderActivityGraph` |

`src/cards/repo-pin.ts` is the exception: `renderAllRepoPins` returns one `{ fileName, svg }` per featured repo, written as `pin-<repo>.svg`. The featured list lives in `FEATURED_REPOS` in `src/fetch/github.ts`; adding a repo there adds a pin, and the README must be updated to reference it.

## Adding or Changing a Card

1. Create `src/cards/<card-name>.ts` exporting a single pure `render*(data: ProfileData): string`.
2. Import chrome and tokens from `../theme.ts`. Never hardcode a color, font stack, radius, or padding.
3. Import `ProfileData` with `import type` so registering the card in `src/index.ts` cannot create a runtime cycle.
4. Handle a null data slice by returning a short "unavailable" card rather than throwing.
5. Register it in `CARD_RENDERERS` and add the image to `README.md`.

## SVG Constraints

GitHub proxies README images through camo and sanitizes SVG, so every card must be fully self-contained:

- No external fonts, images, stylesheets, or any network reference. The only permitted URL is the `xmlns` namespace.
- No `foreignObject` - it is stripped. Lay text out with `x`/`y` and `text-anchor`.
- Animation is SMIL `<animate>` only, used sparingly. Static attributes must already hold the resting/final value so renderers that sample frame zero show a complete card.
- SVG has no text metrics, so text widths are estimated from per-character advance ratios. When changing copy or font sizes, re-check for collisions.
- Validate with `xmllint --noout output/*.svg` after changes.

## Publishing

`.github/workflows/generate-profile.yml` runs every 6 hours, on push to `main`, and on manual dispatch. It installs dependencies, runs `pnpm generate` with `secrets.PROFILE_PAT` as `GITHUB_TOKEN` (a PAT with `repo` scope so private contributions are counted), then publishes `output/` to the orphan `output` branch by reinitializing a git repo inside `output/` and force-pushing with `secrets.GITHUB_TOKEN`. The publish step aborts if `output/` is empty.

`main` never contains generated SVGs. To change what the profile shows, change the generator on `main` and let CI republish.

## Coding Style & Naming Conventions

- TypeScript with ESM. Use `type`, never `interface`. Type-only imports use `import type`.
- Named functions use the `function` keyword; arrow functions only for callbacks and anonymous functions.
- Prefer an options object over multiple positional parameters.
- `catch (error: unknown)`, never `err`. Always `await`, never `.then()` chains.
- kebab-case filenames, camelCase variables, PascalCase types, SCREAMING_SNAKE_CASE constants.
- Keep types next to the code that uses them; no standalone `types.ts`.
- No comments that restate the code.
- Prettier config is `printWidth 80`, no semicolons, single quotes, trailing commas. Markdown is excluded via `.prettierignore`.

## Testing Guidelines

No automated tests are configured. Verify changes by:

- Running the generator against live data and confirming `svgs skipped: 0` and `warnings: 0`.
- Running `xmllint --noout` over every generated SVG.
- Rasterizing the cards (headless Chrome or `qlmanage`) and checking for text collisions and overflow.
- Spot-checking the rendered README on GitHub after the `output` branch updates.

## Security & Configuration Tips

- Never commit tokens. The generator reads `GITHUB_TOKEN` from the environment only.
- `PROFILE_PAT` must be a repository secret. A narrower token silently reduces private contribution and language totals rather than failing.
- Do not reintroduce third-party dynamic image services in `README.md`. Static `img.shields.io` badges in the "Connect with me" section are the only exception.
