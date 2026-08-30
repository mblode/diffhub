<div align="center">

# [DiffHub](https://blode.co/diffhub)

**A cmux git diff viewer for reviewing a whole branch, with inline comments you can hand to an agent**

Run one command inside any git repository and DiffHub serves a GitHub-style diff of your working tree at `localhost:2047`.

<p align="center">
  <a href="https://www.npmjs.com/package/diffhub">
    <img src="https://img.shields.io/npm/v/diffhub?style=flat&colorA=000000&colorB=000000" />
  </a>
  <a href="https://github.com/mblode/diffhub/blob/main/LICENSE.md">
    <img src="https://img.shields.io/github/license/mblode/diffhub?style=flat&colorA=000000&colorB=000000" />
  </a>
</p>

</div>

## Demo

Browse any public GitHub pull request in the hosted viewer, with nothing installed.

<p>
<a href="https://blode.co/diffhub/oven-sh/bun/pull/16000">
<img alt="View the demo" src=".github/assets/demo.svg" width="200" />
</a>
</p>

![DiffHub reviewing a branch](.github/assets/screenshot.png)

## Install

```bash
npm install -g diffhub
```

Or run it without installing: `npx diffhub@latest`.

## Quickstart

Run inside any git repository.

```bash
# Review the current branch in a cmux browser split
diffhub cmux

# The same viewer in your default browser
diffhub

# Compare against a different base branch
diffhub cmux --base develop

# Review a repository in another directory
diffhub cmux --repo ~/Code/mblode/cmux
```

The default view is `touched`: `HEAD` versus the working tree, including untracked files. Merge-base scopes (`all`, `committed`) are available from the status bar, and `--base` still selects the comparison branch, preferring `origin/main` so unpushed commits show up. A watcher marks updates available; press `r` to refresh. `diffhub cmux` uses a repo-derived port in 20000–29999 instead of 2047.

## Commands

| Command         | Description                                 |
| --------------- | ------------------------------------------- |
| `diffhub`       | Open DiffHub in your default browser        |
| `diffhub cmux`  | Open DiffHub in a cmux browser split        |
| `diffhub serve` | Same as `diffhub`, starts the local web app |

## Options

### `diffhub` and `diffhub serve`

| Flag                  | Default | Description                 |
| --------------------- | ------- | --------------------------- |
| `-p, --port <port>`   | `2047`  | Port to serve on            |
| `-r, --repo <path>`   | `cwd`   | Path to the git repository  |
| `-b, --base <branch>` | auto    | Base branch to diff against |
| `--no-open`           |         | Skip automatic browser open |

### `diffhub cmux`

| Flag                  | Default | Description                 |
| --------------------- | ------- | --------------------------- |
| `-r, --repo <path>`   | `cwd`   | Path to the git repository  |
| `-b, --base <branch>` | auto    | Base branch to diff against |

## Keyboard shortcuts

| Key        | Action                               |
| ---------- | ------------------------------------ |
| `j` / `k`  | Next / previous file                 |
| `s`        | Toggle split / stacked view          |
| `c`        | Collapse or expand the selected file |
| `Shift+C`  | Collapse all files                   |
| `Shift+E`  | Expand all files                     |
| `/` or `t` | Focus the file filter                |
| `r`        | Refresh the diff                     |
| `F2`       | Toggle the Diff stats panel          |

## Notes

- Node.js 20.11+ or Bun 1.0.23+, and a git repository (`git rev-parse --show-toplevel` must succeed).
- cmux mode expects `cmux.app` installed on macOS at `/Applications/cmux.app`.
- Comments live in `.git/diffhub-comments.json` in the repository you are reviewing, and copy out as a markdown review prompt for a coding agent.

## License

MIT

---

Crafted by [<img src="https://blode.co/avatar-circle.png" width="20" align="top" />](https://blode.co) [Matthew Blode](https://blode.co)
