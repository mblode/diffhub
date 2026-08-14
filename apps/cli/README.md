# DiffHub

[![npm version](https://img.shields.io/npm/v/diffhub)](https://www.npmjs.com/package/diffhub)
[![Node.js 20.11+](https://img.shields.io/badge/node-20.11+-green)](https://nodejs.org)
[![Bun 1.0.23+](https://img.shields.io/badge/bun-1.0.23+-green)](https://bun.sh)

Git diff viewer for cmux. Opens in a browser split and shows `HEAD` versus the working tree by default (`touched`), with status-bar scopes for merge-base and staged/unstaged views, split/unified diffs, and inline comments. A watcher marks updates; refresh is manual (`r`).

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

Opens `http://localhost:2047` and shows `HEAD` versus the working tree. Use `--base` to pick the comparison branch (`main`, `master`, `develop`, or `dev`, auto-detected). Switch scopes in the status bar: `all`, `committed`, `staged`, `unstaged`, `touched`.

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

## Features

- **Working-tree diff** — defaults to `touched` (`git diff HEAD` plus untracked); status bar switches `all` / `committed` / `staged` / `unstaged` / `touched`
- **Split and unified views** — toggle with `s`, keyboard-navigable with `j` / `k`
- **Inline comments** — add `[must-fix]`, `[suggestion]`, `[nit]`, or `[question]` notes on any diff line; copy all comments as a formatted prompt
- **Copy path** — file headers expose a copy-path control
- **Manual refresh** — watches local file changes and marks updates available; press `r` or the status-bar refresh control
- **File sidebar** — filter files with `/` or `t`, see per-file `+`/`-` stats at a glance

## Development notes

- The standalone CLI injects `DIFFHUB_REPO` into the Next.js server process.
- Local development can also point at a repo through `DIFFHUB_REPO` or the `/tmp/diffhub-active-repo` pointer file used by `diffhub-point`.
- The app ships a standalone Next.js build via `bin/diffhub.mjs`, not `next start`.

## Keyboard shortcuts

| Key         | Action                               |
| ----------- | ------------------------------------ |
| `j` / `k`   | Next / previous file                 |
| `s`         | Toggle split / unified view          |
| `c`         | Collapse or expand the selected file |
| `Shift+C`   | Collapse all files                   |
| `Shift+E`   | Expand all files                     |
| `/` or `t`  | Focus file filter                    |
| `r`         | Refresh the diff                     |
| `F2`        | Toggle the Diff stats panel          |

## Options

| Flag                  | Default | Description                 |
| --------------------- | ------- | --------------------------- |
| `-p, --port <port>`   | `2047`  | Port to serve on            |
| `-r, --repo <path>`   | `cwd`   | Path to the git repository  |
| `-b, --base <branch>` | auto    | Base branch to diff against |
| `--no-open`           | —       | Skip automatic browser open |

## Requirements

- Node.js 20.11+ or Bun 1.0.23+
- A git repository (`git rev-parse --show-toplevel` must succeed)

## License

MIT
