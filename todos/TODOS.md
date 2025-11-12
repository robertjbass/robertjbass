# GitHub Profile README TODOs

## Future Enhancements

### Recent Activity
- [ ] Set up GitHub Actions workflow for recent activity
- [ ] Use [jamesgeorge007/github-activity-readme](https://github.com/jamesgeorge007/github-activity-readme)
- [ ] Add activity section to README with placeholder comments
- [ ] Configure workflow to run on schedule (e.g., every hour)
- [ ] Test that activity updates are appearing correctly

### Snake Animation (Eating Contributions)
- [ ] Set up GitHub Actions workflow for snake animation
- [ ] Use [Platane/snk](https://github.com/Platane/snk)
- [ ] Configure workflow to generate SVG on schedule
- [ ] Create `output` branch to store generated SVG
- [ ] Add snake animation SVG to README
- [ ] Verify animation is rendering correctly on profile

## Resources

**Recent Activity Setup:**
```yaml
# .github/workflows/update-readme.yml
name: Update README

on:
  schedule:
    - cron: '0 * * * *' # Runs every hour
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: jamesgeorge007/github-activity-readme@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Snake Animation Setup:**
```yaml
# .github/workflows/snake.yml
name: Generate Snake

on:
  schedule:
    - cron: "0 */12 * * *" # every 12 hours
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: Platane/snk@v3
        with:
          github_user_name: robertjbass
          outputs: |
            dist/github-snake.svg
            dist/github-snake-dark.svg?palette=github-dark
      - uses: crazy-max/ghaction-github-pages@v3
        with:
          target_branch: output
          build_dir: dist
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
