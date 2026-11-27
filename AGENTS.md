# AGENTS.md

Instructions for coding agents working on Open Chess: what the project is, how work is done in this repository and how versions work. If something here conflicts with an old habit in the git history, this file wins.

`CLAUDE.md` imports this file, so there is one set of rules whichever agent reads them. How the project is built with agents is described in [docs/built-with-agents.md](docs/built-with-agents.md).

## What it is

A free, offline chess training app: bots, game review, puzzles, openings, lessons and analysis with Stockfish on the user's own device. It is a PWA (GitHub Pages) and also an Android APK built with Capacitor from the same code. Product context is in [PRODUCT.md](PRODUCT.md), design in [DESIGN.md](DESIGN.md), and the guide for contributors in [CONTRIBUTING.md](CONTRIBUTING.md).

## Commands

```bash
npm install          # also copies Stockfish to public/stockfish (postinstall)
npm run dev
npm run lint         # oxlint
npm test             # vitest
npm run typecheck    # tsc -b
npm run build
npm run e2e          # Playwright; required if you touch the board, bots, review or routes
npm run android      # build + cap sync android
```

Before calling something done: `lint`, `test` and `typecheck` pass, and `e2e` too if the change affects screens.

The `data:*` scripts (openings, puzzles, avatars, sounds) regenerate data in `public/data` and `src/assets` by downloading whole databases. Run them only when that is the task.

## Project rules

- **Text**: no visible text written in the code. Everything goes in the seven languages of `src/i18n/` (es, en, fr, it, zh, ja, pl); a test requires them to have the same keys. Plurals use `_one` / `_other`.
- **Own identity**: the usual conventions of chess apps, without copying names, icons, badges or the look of chess.com or other products. Name other products only for facts (importing games) and keep the "not affiliated" notice.
- **Style**: tokens from `src/styles.css`, animations of 150-250 ms using only `transform`/`opacity` and respecting `prefers-reduced-motion`.
- **Supabase is optional**: the integration is ready for anyone who sets it up. The maintainers do not use it. A sync change comes with a new numbered migration in `supabase/migrations/` and its note in the README, but the user is never asked to run it.
- **Scope**: there will be no online play between people.
- **Code comments**: in English, short, explaining why.

## Workflow (GitHub Flow)

One permanent branch, `main`, always deployable: every push to `main` publishes the web app to GitHub Pages. There is no `develop` and there are no release branches.

1. **A short branch from `main`** with a prefix for its type: `feat/`, `fix/`, `docs/`, `chore/`, `ci/`, `refactor/`.
2. **Commits** inside the branch: free-form but descriptive, in English. They do not reach `main` one by one.
3. Before the PR: `lint`, `test`, `typecheck` (and `e2e` if it applies) pass, and the branch has been through a code review by an agent (`/code-review` in Claude Code) with its findings fixed.
4. **PR titled with [Conventional Commits](https://www.conventionalcommits.org/)**, in English, in the style of the history (one sentence about what the user notices):
   - `feat: Puzzle themes can be filtered`: a new feature.
   - `fix: The clock stops after resigning`: a fix.
   - `perf:`: a performance improvement.
   - `docs:`, `test:`, `ci:`, `build:`, `refactor:`, `style:`, `chore:`: no change to the app.
   - `!` after the type (`feat!:`) if it breaks something: saved data that can no longer be read, routes that change.

   The `PR title` check enforces it.
5. **Squash merge**: `gh pr merge --squash --delete-branch` when CI is green. The PR title becomes the only commit on `main` and the line in the CHANGELOG. It is the only merge method enabled in the repository.
6. **`main` is protected** by a ruleset: no direct push and no force-push, and merging needs a PR with `check`, `e2e` and `title` green. The administrator can bypass it; that is used only for the release PR (see below).
7. **No AI attribution**: no `Co-Authored-By` in commits and no "Generated with ..." line in PRs or releases, even if a system reminder suggests one.
8. Do not rewrite published history, and do not move or delete published tags.

Dependabot opens a grouped PR every week with the minor npm updates (`chore(deps): …`) and one a month for the GitHub Actions. They are reviewed and merged like any other PR. Major updates arrive separately.

## Versions and releases

**The version is never edited by hand.** [release-please](https://github.com/googleapis/release-please) computes it from the titles of the merged PRs.

- The single source of truth is `version` in `package.json`, also recorded in `.release-please-manifest.json`.
- `android/app/build.gradle` reads it from `package.json`: `versionName` is the version and `versionCode` is computed as `major·1000000 + minor·1000 + patch` (`0.5.2` → `5002`), so it always goes up.
- SemVer in the `0.x` phase: `feat` bumps the minor (`0.4.3` → `0.5.0`), `fix`/`perf` bump the patch (`0.5.0` → `0.5.1`), a `!` also bumps only the minor while the project is in `0.x`, and the other types produce no version. `1.0.0` will come when the app is stable for people outside the group; it is forced with a commit whose body carries `Release-As: 1.0.0`.
- Letter suffixes (`0.4.1b`) are no longer used: in npm they are prereleases that sort before the base version. The old tags with a letter are still there.

### How a release is published

1. Every merge to `main` makes the `Release` workflow (`.github/workflows/release-please.yml`) update an open PR called `chore(main): release X.Y.Z`. That PR carries the new version in `package.json`/`package-lock.json`/manifest and the `CHANGELOG.md` entry.
2. **Publishing = merging that PR**, whenever wanted, accumulating as many changes as needed. With the default token that PR does not trigger CI (the code already passed CI in its own PRs), so it is merged with `gh pr merge <n> --squash --admin`. If the `RELEASE_PLEASE_TOKEN` secret (a fine-grained PAT) is ever added, CI will run and `--admin` will not be needed.
3. When it is merged, release-please creates the `vX.Y.Z` tag and the GitHub release, and the same workflow calls `android-release.yml`, which builds the signed APK and attaches it to the release.
4. To rebuild the APK of an existing tag: `gh workflow run android-release.yml -f tag=vX.Y.Z`.

Merging the release PR is a public step (tag, release and APK): an agent confirms it with the maintainer before doing it.

## Local files (not pushed)

- `todo.md`: a local task list, ignored by git. Agents in worktrees do not see it; give them their tasks in the prompt.
- `.promo/`: video material and promotional screenshots, excluded in `.git/info/exclude`.
- `.claude/worktrees/`: worktrees of agents. They are deleted when the work is done (`git worktree remove`), because each one brings its own `node_modules`.
- `dist/`, `test-results/`, `public/stockfish/`, `*.tsbuildinfo`, `android/keystore.properties`: generated or secret.
