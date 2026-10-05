---
type: "Guide"
title: "Development"
description: "Tooling, quality gates and conventions for working on this repo: Node version, TypeScript, Biome, tests, coverage, comment policy, CI and releasing."
---

# Development

## Setup

```bash
nvm use
npm install
npm run verify
```

`.nvmrc` pins the Node version used for development and CI. The scripts in `scripts/` are TypeScript files run directly by Node, which needs a recent version. The bundled CLIs themselves target Node 22, the oldest release line still supported, and the published packages declare `node >=22`.

`npm install` also installs the Husky pre-commit hook.

A linked git worktree, such as the ones Claude Code sessions run in under `.claude/worktrees/`, needs its own install. Run `npm ci` there before the first build. A build that stops with `Could not resolve "commander"` means the worktree's `node_modules` is missing or incomplete. The shell that commits needs the Node version from `.nvmrc` as well, because the pre-commit hook runs `npm run verify`.

## Commands

| Command | What it does |
|---|---|
| `npm run verify` | lint, typecheck, build, tests with coverage |
| `npm run lint` | Biome check |
| `npm run lint:fix` | Biome with fixes applied |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | bundle each CLI into `packages/*-cli/dist` and link it into its plugin |
| `npm run pin` | pack both CLIs into `release/` and pin the plugins to those tarballs |
| `npm test` | run the tests once |
| `npm run test:watch` | run the tests in watch mode |
| `npm run test:coverage` | run the tests with the coverage gate |

## Quality gates

All of these run in `npm run verify`, in the pre-commit hook and in CI.

- **Biome** for formatting and lint, with the recommended rule set. Formatting is 2 spaces, double quotes, semicolons, no trailing commas and a 120 column line.
- **TypeScript in strict mode**, with unused locals and parameters as errors. Code is ESM and imports carry explicit `.js` extensions.
- **100% coverage** of statements, branches, functions and lines over `packages/`, excluding tests, the test helpers, the thin entry files in `packages/*/src/bin` and the process-bound `Io` in `packages/cli-common/src/process-io.ts`.
- **Package versions up to date.** The build copies the root version into `packages/*-cli/package.json` before the tests run, and the hook and CI fail when those files differ from what is committed.

## Comments

Comments are a convention, not a gate. The default is no comments: the code should explain itself and the reasoning lives here in `docs/` or in the commit message.

A comment is allowed only when it is critical, meaning a reader would misread or break the code without it and no better name, type or smaller function can carry the point. Such a comment is short and says why, not what. `CLAUDE.md` carries the same rule for Claude Code.

## Tests

- Vitest. Unit tests sit next to the code as `*.test.ts`.
- `packages/testing` holds the helpers: temp directories, throwaway git repos, linked worktrees (also of a bare repo) and a captured `Io`.
- `tests/bundle.test.ts` runs the built bundles as real executables. It checks the thing users install: the shebang, the bundled dependencies and reading hook input from stdin. It also runs every command in each plugin's `hooks.json` with `CLAUDE_PLUGIN_ROOT` set, so a hook path that does not match the package name or its `bin` fails the build.
- `vitest.setup.ts` points `GLOBU_HOME` and `CLAUDE_CONFIG_DIR` at a fresh temp directory before every test, so no test can read or write the developer's real configuration. It also removes every `GIT_*` variable from the environment. A git hook in a linked worktree exports `GIT_DIR`, and with it set the `git init` in a test would act on the real repository instead of the temp one. `CLAUDE_PROJECT_DIR` is cleared before every test as well, because the guard reads it to find the session's home repo and the tests may themselves run inside a Claude Code session.
- Git behaviour is tested against real repositories created in temp directories. Remote repos are `file://` URLs. A test that expects a shard to be matched to a directory needs a real repo for both, because matching asks git. A made-up path only works where no match is expected.

## Design choices that keep the code testable

- Each CLI is a commander program built and run by `runCli` in `packages/cli-common`. It takes an `Io` object (output, error output, stdin and working directory) and returns an exit code. Commander runs with `exitOverride` and writes through `Io`, so nothing calls `process.exit` or reads `process.cwd()` directly and every command runs in-process under test.
- A command sets a non-zero exit code through the `exit` callback it is given. A thrown error becomes `<name>: <message>` on the error output and exit code 1. Usage errors are reported by commander, also with exit code 1.
- Manifest, state and hook input are parsed with zod schemas. A hand-edited file fails with one clear message at load time, and the rest of the code works with known shapes and needs no defensive checks.

## Continuous integration

`.github/workflows/verify.yml` runs on pull requests and on pushes to `main`: install, `npm run verify`, then a check that the committed package versions match the root version.

## Working on the plugins locally

`npm run build` links each CLI package into its plugin as `plugins/<plugin>/node_modules/@mercastra/<name>`. That directory is ignored by git. With the link in place the hooks and skills of the working tree run the freshly built CLI:

```bash
npm run build
claude --plugin-dir ./plugins/knowledge-base --plugin-dir ./plugins/globu
```

## Releasing

The root `package.json` holds the version. The build copies it into `packages/*-cli/package.json`, and `knowledge-base setup` stamps it into every base it touches as `knowledge_base_version`.

A release publishes both CLIs and then pins the plugins to them:

1. Bump the version with `npm version <version> --no-git-tag-version`, run `npm run build` and merge that to `main`. The command also updates the root `package-lock.json`, and the build updates the two CLI `package.json` files, so the bump commit touches four files.
2. Run the `Release` workflow (`.github/workflows/release.yml`) from the Actions tab, or with `gh workflow run release.yml --ref main` and then `gh run watch <run-id> --exit-status`. A run takes about six minutes, most of it waiting for the tarballs.
3. Pull `main` afterwards. The workflow adds the pin commit, so a local `main` is one commit behind.

Every release needs a new version. npm never accepts a version twice, so a run on an already published version fails at the publish step. `npm view @mercastra/globu versions` shows what is taken.

The workflow runs `npm run verify`, then:

1. `npm run pin` packs each CLI into `release/`, writes `plugins/*/package.json` and `package-lock.json` with the integrity hash of that tarball and sets `version` in each `plugin.json`.
2. `npm publish` uploads exactly those tarballs as public packages, which `publishConfig.access` in each `package.json` sets. The path needs its leading `./`, because npm reads a bare `release/<file>` as a GitHub `owner/repo` shorthand. It authenticates through npm trusted publishing, so the workflow holds no token.
3. The workflow waits until both tarballs can be downloaded. npm accepts a publish before the files are served, and that can take a few minutes.
4. The pin is committed to `main` and `stable` is moved to that commit. Installed plugins update from `stable` because the `plugin.json` version changed.

A package has to exist on npm before a trusted publisher can be configured for it, so the first release of each package is done by hand with the same steps:

```bash
npm run verify
npm run pin
npm publish ./release/mercastra-knowledge-base-<version>.tgz
npm publish ./release/mercastra-globu-<version>.tgz
git add plugins
git commit -m "Pin plugins to <version>"
git push origin HEAD:main HEAD:stable
```

Packing is reproducible. If a release fails after publishing, `npm run build && npm run pin` on the released commit writes the same pin again.
