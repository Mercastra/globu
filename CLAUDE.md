# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Globu plugs into Claude Code so Claude can find the right knowledge for a task and write new knowledge back. The repo ships two plugins: `knowledge-base` (OKF knowledge bases inside one repo, works alone) and `globu` (a per-user registry of knowledge shards). Start from [docs/index.md](docs/index.md): [architecture](docs/architecture.md), [development](docs/development.md) and [decisions](docs/decisions.md).

## Commands

- `npm run verify` runs everything: lint, typecheck, build and tests with coverage. The Husky pre-commit hook runs it, and CI runs it on pull requests and on `main`.
- `npm test` runs the tests once. A single file: `npx vitest run packages/globu-core/src/registry.test.ts`.
- `npm run lint:fix` formats and fixes lint. Do not hand-format.
- `npm run build` bundles each CLI into `packages/*-cli/dist` and links it into the matching plugin's `node_modules`.
- `npm run pin` packs both CLIs into `release/` and pins each plugin to its tarball. It is part of a release, not of daily work.

Node version comes from `.nvmrc`.

## Rules that are enforced

- **Coverage is 100%** for statements, branches, functions and lines (`vitest.config.ts`). It is a gate. Add tests with the change. Do not lower the thresholds or add ignore directives to get past it. Prefer removing a defensive branch that cannot happen over testing around it.
- **Nothing compiled is committed.** `packages/*/dist` is ignored. Plugins get their CLI from npm through `plugins/*/package.json` and `package-lock.json`, which only `npm run pin` writes. Do not edit those two files or the `version` in `plugin.json` by hand.
- **Package versions follow the root `package.json`.** The build copies the root version into `packages/*-cli/package.json`. The pre-commit hook and CI fail when they differ from what is committed.
- **`packages/knowledge-base` never imports from `packages/globu-core`**, and `packages/knowledge-base-cli` never imports it either. The standalone plugin must not depend on Globu.

## Comments

Be very restrictive about comments. The default is none, and nothing enforces this, so it is on you.

- Add a comment only when it is critical: without it a reader would misread the code or break it, and no better name, type or smaller function can carry the point. A workaround for an upstream bug or a non-obvious ordering or security constraint can qualify.
- Never write comments that restate the code, narrate a change, label sections or document signatures. No JSDoc, no TODOs, no commented-out code.
- Reasoning goes in `docs/` or the commit message.
- A critical comment is one or two lines and says why, not what.
- Tool directives such as `biome-ignore` and `@ts-expect-error` are not comments in this sense, but they need the same justification.
- When unsure, leave it out.

## Style

- TypeScript, strict, ESM. Imports use explicit `.js` extensions (`import x from "./foo.js"` for `./foo.ts`).
- Biome handles formatting and lint.
- Tests sit next to the code as `*.test.ts`. Shared test helpers live in `packages/testing`. `tests/` holds only the checks that run the built bundles and the plugin hooks.
- Tests never touch the real `~/.globu` or `~/.claude`: `vitest.setup.ts` points `GLOBU_HOME` and `CLAUDE_CONFIG_DIR` at a fresh temp directory before every test.
- The CLIs never prompt and never call `process.exit`. They are commander programs run through `runCli` in `packages/cli-common`, which sends all output through an `Io` object and returns an exit code. That is what makes them testable in-process.
- Config files read from disk are parsed with zod schemas (`manifest.ts`, `state.ts`).

## Writing style for docs and prose

- No em dashes or en dashes. Use a hyphen, a comma, a colon or a full stop.
- No Oxford comma.

## Keeping docs true

`docs/` is an OKF base maintained with the tools in this repo. Treat doc updates as part of the change:

- Changed a command, flag or hook? Update [docs/globu-cli.md](docs/globu-cli.md) or [docs/knowledge-base-plugin.md](docs/knowledge-base-plugin.md), and the matching skill under `plugins/*/skills`.
- Changed how the pieces fit together? Update [docs/architecture.md](docs/architecture.md).
- Took or reversed a design decision? Update [docs/decisions.md](docs/decisions.md).
- Record every docs change with `node packages/knowledge-base-cli/dist/knowledge-base.mjs log docs <YYYY-MM-DD> "<entry>"`.
