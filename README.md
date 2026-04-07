# Claudewatch — App for Ant Browser

Claudewatch is a lightweight companion that mirrors and publishes a working
copy of the upstream **CLAUDE-CODE-FOR-APPLE-SMART-WATCH** project so it can
be served to the [Ant Browser](https://www.antbrowser.org/) as a hosted web
app.

This repository holds:

- `scripts/mirror-to-claudewatch.sh` — a one-shot mirror script that pushes
  either the entire upstream repo or just the `web/` folder to this repo's
  `main` branch.
- The mirrored web payload itself (after the script is run).

---

## Quick start

```bash
# 1. Clone the upstream repo (or pull the latest on your existing clone)
git clone -b claude/apple-watch-claude-app-xlos7 \
  https://github.com/Everaldtah/CLAUDE-CODE-FOR-APPLE-SMART-WATCH.git
cd CLAUDE-CODE-FOR-APPLE-SMART-WATCH

# 2. Export a GitHub token with `repo` scope
#    (create one at https://github.com/settings/tokens)
#    Do NOT paste it directly on the CLI history.
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 3a. Push the WHOLE repo to Claudewatch-app-for-ant-browser:main
./scripts/mirror-to-claudewatch.sh

# 3b. …or publish ONLY the web/ folder as the root of that repo
./scripts/mirror-to-claudewatch.sh --web-only
```

---

## How it works

The script (`scripts/mirror-to-claudewatch.sh`) performs the following steps:

1. Validates that `GITHUB_TOKEN` is exported.
2. Resolves the upstream repo root via `git rev-parse --show-toplevel`.
3. Copies the desired payload into a clean temporary working directory:
   - Default: the entire repo (excluding `.git`) via `rsync`.
   - `--web-only`: only the contents of `web/`, promoted to the root.
4. Initialises a fresh git repo on the `main` branch in that temp dir.
5. Commits everything as a single mirror commit.
6. Force-pushes to
   `https://github.com/Everaldtah/Claudewatch-app-for-ant-browser.git` on
   `main` using the supplied token.
7. Cleans up the temporary directory.

> The push is a **force-push** because this repo is treated as a publish
> target, not a development branch. Do not commit work directly here — it
> will be overwritten on the next mirror.

---

## Requirements

- `bash` (4+)
- `git`
- `rsync`
- A GitHub Personal Access Token with `repo` scope, exported as
  `GITHUB_TOKEN`.

---

## Modes

| Mode          | Command                                         | What lands on `main`            |
| ------------- | ----------------------------------------------- | ------------------------------- |
| Full mirror   | `./scripts/mirror-to-claudewatch.sh`            | The entire upstream repo        |
| Web-only      | `./scripts/mirror-to-claudewatch.sh --web-only` | Contents of `web/` as the root  |

Use **web-only** when you want the published repo to be directly servable as
a static site (e.g. via GitHub Pages or the Ant Browser app loader).

Use **full mirror** when you want a complete snapshot of the source project,
including build scripts and watchOS sources.

---

## Security notes

- Never paste your `GITHUB_TOKEN` inline on the command line; export it from a
  shell profile, a secrets manager, or `read -s`.
- The script injects the token into the remote URL only inside an ephemeral
  temp directory and never writes it to disk in this repo.
- The temp directory is removed on exit via a `trap`.

---

## Troubleshooting

**`ERROR: GITHUB_TOKEN is not set`**
Export a PAT with `repo` scope before running the script.

**`--web-only requested but no web/ directory exists`**
You're not inside the upstream `CLAUDE-CODE-FOR-APPLE-SMART-WATCH` checkout,
or that branch doesn't have a `web/` folder. Re-clone the correct branch.

**Push rejected / 403**
Your token is missing `repo` scope, or doesn't have write access to
`Everaldtah/Claudewatch-app-for-ant-browser`.

---

## License

Mirrors the license of the upstream project.
