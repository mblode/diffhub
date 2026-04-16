# DiffHub

[![npm version](https://img.shields.io/npm/v/diffhub)](https://www.npmjs.com/package/diffhub)
[![Node.js 20.11+](https://img.shields.io/badge/node-20.11+-green)](https://nodejs.org)

Local diff viewer for cmux.

DiffHub opens your branch in a browser split so you can review it locally. By default it compares against the detected base branch, usually `origin/main`.

![DiffHub screenshot](apps/cli/public/screenshot.png)

## Quick start

### cmux

```bash
npx diffhub@latest cmux
```

Run that inside any git repository. DiffHub starts the local viewer and opens it in a cmux browser split.

cmux mode currently expects `cmux.app` on macOS at `/Applications/cmux.app`.

### Normal browser window

```bash
npx diffhub@latest
```

Use that if you want the same viewer in your default browser instead.

### Global install

```bash
npm install -g diffhub
```

## What it does

- Opens in a cmux browser split
- Shows your branch against the merge-base
- Supports split and unified views
- Lets you add notes and open files in your editor

## Usage

Run inside any git repository.

```bash
# Open in cmux
diffhub cmux

# Open in a normal browser window
diffhub
```

```bash
# Use a different base branch
diffhub cmux --base develop

# Point at a repo in another directory
diffhub cmux --repo ~/projects/my-app

# Use a different port in browser mode
diffhub --port 3000

# Don't open the browser automatically
diffhub --no-open
```

### Commands

| Command         | Description                                 |
| --------------- | ------------------------------------------- |
| `diffhub`       | Open DiffHub in your default browser        |
| `diffhub cmux`  | Open DiffHub in a cmux browser split        |
| `diffhub serve` | Same as `diffhub`, starts the local web app |

### `diffhub` / `diffhub serve` options

| Flag                  | Default | Description                 |
| --------------------- | ------- | --------------------------- |
| `-p, --port <port>`   | `2047`  | Port to serve on            |
| `-r, --repo <path>`   | `cwd`   | Path to the git repository  |
| `-b, --base <branch>` | auto    | Base branch to diff against |
| `--no-open`           | —       | Skip automatic browser open |

### `diffhub cmux` options

| Flag                  | Default | Description                 |
| --------------------- | ------- | --------------------------- |
| `-r, --repo <path>`   | `cwd`   | Path to the git repository  |
| `-b, --base <branch>` | auto    | Base branch to diff against |

## Keyboard shortcuts

| Key       | Action                      |
| --------- | --------------------------- |
| `j` / `k` | Next / previous file        |
| `s`       | Toggle split / unified view |
| `/`       | Focus file filter           |
| `r`       | Refresh diff                |

## Requirements

- Node.js 20.11+
- A git repository with at least one commit on your current branch
- For `cmux` mode, `cmux.app` installed on macOS

## License

MIT
