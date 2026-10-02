---
type: "Architecture"
title: "Globu architecture"
description: "The two products in this repo, how they relate and how Globu's registry, probe, drivers and Claude Code integration fit together."
---

# Globu architecture

Globu plugs into Claude Code so Claude can find the right knowledge for a task and write new knowledge back after a session. This repo ships two products that install separately.

| Product | Scope | Needs the other? |
|---|---|---|
| `knowledge-base` plugin | One repo, any number of OKF `docs/` bases inside it | No |
| `globu` plugin and CLI | The per-user layer: which knowledge sources exist for me, when to consult them and where writes may go | No |

The dependency runs one way. Globu knows about OKF bases through its `okf` driver. `knowledge-base` knows nothing about Globu. Both use the shared OKF library in `packages/knowledge-base`.

## Vocabulary

- **Shard**: one registered unit of knowledge. Today a shard is one git repo.
- **Root**: a place inside a shard where knowledge starts, with an entry file. An OKF repo with a base per package is one shard with many roots.
- **Format**: how a shard's knowledge is laid out. Each format has a driver.
- **Context**: a named selection of shards, for example `work` or `personal`.
- **Manifest**: the portable list of shards and contexts.
- **State**: what is true only on this machine.

## Configuration

Everything lives in `~/.globu` (override with `GLOBU_HOME`).

`manifest.yaml` is portable. It can be kept in a dotfiles repo and symlinked.

```yaml
version: 1
shards:
  - id: product
    source: { type: git, repo: git@github.com:acme/product.git }
    format: okf
    roots:
      - { path: docs, name: product, entry: docs/index.md }
    description: Product decisions and domain rules
    useWhen: Pricing, roadmap or domain modelling questions
    access: read
contexts:
  work: [product, team-*]
```

`state.yaml` is per machine and never shared.

```yaml
version: 1
current: work
shards:
  product: { path: /Users/me/.globu/clones/product, mode: read, owner: globu }
claude:
  directories: []
```

The rule that separates them: anything true on every machine goes in the manifest, anything true only here goes in state.

## Clones

| | Read-only shard | Editable shard |
|---|---|---|
| Owner | `globu` | `user` |
| Location | `~/.globu/clones/<id>` | a path the user chose, or an existing clone adopted in place |
| Clone | shallow | full |
| `globu sync` | fast-forward pull | fetch only, never resets or switches branch |

A shard's effective mode is the stricter of two settings: the manifest's optional `access: read` cap and the local `mode` in state.

## Resolver

The resolver merges manifest and state into resolved shards (`id`, `path`, `mode`, `owner`, `present`, `format`, `roots`, routing text). Every command and hook works from that list. The active context filters it: `GLOBU_CONTEXT` wins, then `current` in state, and with neither set every shard is active.

## Probe and drivers

The probe turns a directory into a shard proposal. It asks each driver in order whether it recognises the directory. The first match wins and the result is pinned in the manifest, so the probe runs at registration and not every session. `globu doctor` reports drift and `globu reprobe` refreshes the pinned result.

A driver has a fixed interface:

| Member | Purpose |
|---|---|
| `name` | The format name pinned in the manifest |
| `detect(dir)` | Returns the roots and a description when the directory is in this format |
| `conventions` | The reading and writing rules given to Claude in the session index |

Drivers so far, in detection order:

1. `okf`: any tracked `docs/index.md` carrying `okf_version`. Each base is a root.
2. `generic`: matches everything. The entry is the README when there is one.

Source and format are separate axes. The only source type so far is `git`.

The CLI detects structure only. Meaning is drafted by Claude: the `register` skill reads the entry files and proposes `description` and `useWhen`, the two lines that decide whether a shard ever gets consulted.

## Claude Code integration

All of it comes from the `globu` plugin, which should be enabled at user scope.

- **SessionStart hook** runs `globu hook session-start`. It prints the active context's index (id, location, routing text, entry files, format conventions) and Claude Code adds that to the session. It prints nothing when no shards are registered. It reads local files only.
- **PreToolUse guard** runs `globu hook guard` before `Edit`, `Write` and `NotebookEdit`. It blocks the edit when the target file sits inside a shard whose effective mode is read.
- **`globu claude sync`** writes the active shards' paths into `permissions.additionalDirectories` in the user's Claude settings so reads need no prompt. It records which entries it added and only ever changes those. It is an explicit command and nothing calls it implicitly.
- **Skills**: `register` and `save-knowledge`.

The repo a session runs in needs nothing. The hooks read `~/.globu` only.

## Writing knowledge back

`save-knowledge` names a target shard for every item, checks the mode and then writes using the shard's format. For `okf` shards it hands the target base directories to `knowledge-base:update-knowledge` when that plugin is installed. Otherwise it follows the authoring guide embedded in the base's `index.md`. Edits are left in the working tree.

Rules that hold everywhere:

- A private shard exists only in its owner's manifest. A shared repo never references it.
- Every write names its target. There is no default shard.
- The CLI never prompts. Skills ask the questions and pass flags.

## Repository layout

```
packages/knowledge-base      shared OKF library: frontmatter, scan, validate, setup, log
packages/knowledge-base-cli  the knowledge-base program, published as @mercastra/knowledge-base
packages/globu-core          manifest, state, resolver, probe, drivers, contexts, Claude settings
packages/globu-cli           the globu program, published as @mercastra/globu
packages/cli-common          what both programs share: Io, the commander runner, hook input
packages/testing             test helpers
plugins/knowledge-base       standalone plugin: skills, edit hook, pinned dependency on its CLI
plugins/globu                registry plugin: skills, session and guard hooks, pinned dependency on its CLI
scripts/                     build and pin
tests/                       checks that run the built bundles and the plugin hooks
```

`packages/knowledge-base` and `packages/knowledge-base-cli` must never import from `packages/globu-core`. `packages/cli-common` knows nothing about shards or bases.

## Distribution

Each CLI is bundled into a single file with no runtime dependencies and published to npm. Nothing compiled is kept in git.

A plugin is a source-only directory: skills, hooks, `plugin.json` and a `package.json` with a `package-lock.json` that pin its CLI to one exact version. Claude Code copies the plugin into its cache on install and then installs that one dependency, so hooks and skills run the CLI from `node_modules/@mercastra/<name>/dist` inside the plugin root.

The marketplace is this repo. Its entries point at the plugin directories on the `stable` branch, which only the release moves. `main` can therefore hold skills that are ahead of the published CLI without anyone installing that mix.

Locally, `npm run build` links each package into its plugin's `node_modules`, so `claude --plugin-dir` runs the working tree.

See [development](./development.md) for tooling and quality gates.
