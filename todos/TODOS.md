# GitHub Profile README TODOs

## Done

### Self-Hosted Profile Cards

- [x] Replace every third-party widget (github-readme-stats, streak-stats, activity-graph, trophies, profile-summary-cards) with cards generated in this repo
- [x] Build the generator: `src/fetch/*` data slices, `src/theme.ts` design system, `src/cards/*` renderers, `src/index.ts` entry point
- [x] Publish generated SVGs to an orphan `output` branch and point the README at `raw.githubusercontent.com`
- [x] Schedule regeneration every 6 hours via `.github/workflows/generate-profile.yml`
- [x] Self-host the streak stats card (`streak-status.svg`) - no Vercel deployment or `demolab.com` dependency
- [x] Self-host the activity graph (`activity-graph.svg`)
- [x] Custom repo pins (`pin-*.svg`) driven by `FEATURED_REPOS`
- [x] Drop the shields.io "My Stack" and "Learning" walls in favor of one line of prose

## Future Enhancements

### Snake Animation (Eating Contributions)

- [ ] Decide whether to render the contribution snake in-house or add [Platane/snk](https://github.com/Platane/snk) as a second workflow writing into the same `output` branch
- [ ] If in-house, needs the full 371-day contribution grid rather than the 60-day window currently fetched

### Data Coverage

- [ ] Contribution history for repo-count velocity so the "300 repositories" milestone can project a date instead of showing "N to go"
- [ ] Widen the npm download window: the point endpoint clamps ranges to ~18 months, so older packages (ask-chat, nodepm-ui, lpgp) are undercounted in the all-time total
- [ ] Backfill the full trailing 365 days of daily counts so the uptime figure on `streak-status.svg` is provable rather than "1 logged incident"

### Cards

- [ ] Recent activity card (opened/merged PRs and releases across the last week) to replace the idea of a text-based activity feed
- [ ] Now-playing or writing card if there is a non-rate-limited source worth pulling from
