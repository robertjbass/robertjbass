# Repository Guidelines

This repository is a GitHub profile README with supporting notes. Changes are primarily Markdown and embedded HTML.

## Project Structure & Module Organization

- `README.md` is the published GitHub profile content.
- `todos/TODOS.md` tracks planned enhancements for the profile README.
- `todos/README-OTHER.md` contains alternate or experimental README content.

## Build, Test, and Development Commands

There is no build system or runtime for this repository.
- Edit Markdown directly in `README.md` and supporting docs.
- Preview in your editor’s Markdown renderer or by viewing the README on GitHub.

## Coding Style & Naming Conventions

- Markdown is the primary format; embedded HTML is acceptable where used in `README.md`.
- Match existing formatting: 2-space indentation inside HTML blocks and consistent list styles.
- Keep headings in Title Case and use short, readable link labels.
- Prefer descriptive filenames and keep docs in the `todos/` folder when they are task-oriented.

## Testing Guidelines

No automated tests are configured.
- Manually verify that images, badges, and external links render correctly.
- Spot-check layout on GitHub after changes that affect formatting.

## Commit & Pull Request Guidelines

- Commit messages are short and descriptive; optional prefixes like `chore:` appear in history.
- Keep commits focused on a single change (e.g., “update activity graph links”).
- PRs should include a brief summary, list any new external URLs, and attach screenshots for visual README changes.

## Security & Configuration Tips

- Avoid adding secrets or tokens to Markdown files.
- When introducing GitHub Actions or third-party widgets, prefer official sources and document their purpose in `todos/TODOS.md`.
