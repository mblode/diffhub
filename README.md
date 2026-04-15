# DiffHub

[![npm version](https://img.shields.io/npm/v/diffhub)](https://www.npmjs.com/package/diffhub)
[![Node.js 20.11+](https://img.shields.io/badge/node-20.11+-green)](https://nodejs.org)

GitHub PR-style diff viewer. Opens in the browser and shows all changes since your branch diverged from main — split view, inline comments, and live auto-refresh.

![DiffHub screenshot](apps/cli/public/screenshot.png)

## Features

- **PR-style diff** — diffs against the merge-base of your base branch, matching GitHub's "Files Changed" view exactly
- **Split and unified views** — toggle with `s`, keyboard-navigable with `j` / `k`
- **Inline AI comments** — add `[must-fix]`, `[suggestion]`, `[nit]`, or `[question]` notes on any diff line; copy all comments as a formatted prompt
- **"Open in" context menu** — right-click any file to open in Zed, VS Code, Ghostty, Terminal, Finder, or copy the path
- **Live refresh** — polls for changes every 5 seconds; manual refresh with `r`
- **File sidebar** — filter files with `/`, see per-file `+`/`-` stats at a glance

## Install

```bash
npm install -g diffhub
```

Or run without installing:

```bash
npx diffhub
```

## Usage

Run inside any git repository:

```bash
diffhub
```

Opens `http://localhost:2047` and shows all changes between your current branch and `main` (or `master` / `develop`, auto-detected).

```bash
# Use a different base branch
diffhub --base develop

# Point at a repo in another directory
diffhub --repo ~/projects/my-app

# Use a different port
diffhub --port 3000

# Don't open the browser automatically
diffhub --no-open
```

### Keyboard shortcuts

| Key       | Action                      |
| --------- | --------------------------- |
| `j` / `k` | Next / previous file        |
| `s`       | Toggle split / unified view |
| `/`       | Focus file filter           |
| `r`       | Refresh diff                |

## Options

| Flag                  | Default | Description                 |
| --------------------- | ------- | --------------------------- |
| `-p, --port <port>`   | `2047`  | Port to serve on            |
| `-r, --repo <path>`   | `cwd`   | Path to the git repository  |
| `-b, --base <branch>` | auto    | Base branch to diff against |
| `--no-open`           | —       | Skip automatic browser open |

## Requirements

- Node.js 20.11+
- A git repository with at least one commit on your current branch

## License

MIT
