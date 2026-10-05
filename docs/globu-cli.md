---
type: "Reference"
title: "globu CLI"
description: "Command reference for the globu CLI: registering shards, contexts, sync, diagnostics and the hook entry points."
---

# globu CLI

Published as `@mercastra/globu` and built to `packages/globu-cli/dist/globu.mjs`. Source: `packages/globu-cli/src/globu.ts` on top of `packages/globu-core`. Add `--json` to any command. `--help` works on the program and on every command. The CLI never prompts.

Environment:

- `GLOBU_HOME`: config directory, default `~/.globu`.
- `GLOBU_CONTEXT`: overrides the active context for one process.
- `CLAUDE_CONFIG_DIR`: where `claude sync` finds `settings.json`, default `~/.claude`.

## Shards

| Command | Purpose |
|---|---|
| `register <path>` | Adopt the git repo containing `path` in place. Editable unless `--mode read` or `--mode ask`. From a linked worktree it records the main checkout. |
| `register <url>` | Shallow clone into `~/.globu/clones/<id>`, read-only. |
| `register <url> --path <dir>` | Full clone at `dir` (or adopt a matching clone already there), editable. |
| `unregister <id> [--purge]` | Remove from manifest and state. `--purge` also deletes a globu-owned clone. User-owned clones are never deleted. |
| `list [--all]` | Shards in the active context, or all of them. Run inside a worktree of a shard's repo, it adds that worktree as `this session: <dir>`. With `--json` every shard carries `here` and `workPath`. |
| `show <id>` | Everything known about one shard. |
| `set <id> [--description] [--use-when] [--mode] [--access]` | Edit routing text, local mode or the manifest's access cap. |
| `reprobe <id>` | Detect format and roots again and update the manifest. |
| `sync` | Clone shards missing on this machine, pull globu-owned clones, fetch user-owned ones. |

Other `register` flags: `--id`, `--description`, `--use-when`.

Behaviours worth knowing:

- The id defaults to the repo name. Two URL spellings of the same repo (ssh and https) count as the same shard.
- Registering a repo that is already in the manifest attaches a local clone to the existing entry. That is how a manifest synced from another machine gets its paths.
- A repo with no `origin` remote can be registered, but its manifest entry has no URL and other machines cannot sync it.
- `--mode` takes `read`, `ask` or `write`. `ask` lets sessions inside the shard's repo edit it and makes every other session prompt first. `--access` takes `read` or `write`.
- `--mode write` and `--mode ask` are refused for a globu-owned clone. Register the URL again with `--path` to get an editable clone.

## Contexts

| Command | Purpose |
|---|---|
| `context list` | Show contexts and which is active. |
| `context set <name> <id-or-pattern...>` | Define a context. `*` is a wildcard. |
| `context rm <name>` | Delete a context. |
| `use <name>` | Make a context active for new sessions. |
| `use --all` | Clear the active context so every shard is active. |

## Claude Code

| Command | Purpose |
|---|---|
| `index` | Print the text the session hook injects, for the directory it is run in. |
| `claude sync [--remove]` | Add the active shards' paths to `permissions.additionalDirectories`, or remove the ones Globu added. Entries Globu did not add are never touched. |
| `hook session-start` | SessionStart entry point. Prints the index, or nothing. |
| `hook guard` | PreToolUse entry point for `Edit`, `Write`, `NotebookEdit` and `Bash`. Exit code 2 when the target is in a `read` shard. For an `ask` shard changed from a session in another repo it prints a PreToolUse `permissionDecision` of `ask` and exits 0. Targets are matched to shards by git repo, so linked worktrees count wherever they are. For `Bash` it reads `tool_input.command`: certain writes are treated like file edits, possible ones only prompt. See [architecture](./architecture.md) for the rules and their limits. |

## Diagnostics

`doctor` reports, per shard: missing or wrong clone, origin mismatch, format or roots that changed since registration and missing routing text. Exit code 1 when any finding is an error.
