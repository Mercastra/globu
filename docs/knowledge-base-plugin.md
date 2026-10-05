---
type: "Component"
title: "knowledge-base plugin"
description: "What the standalone knowledge-base plugin does: base discovery, ownership rule, commands, hook and skills."
---

# knowledge-base plugin

A Claude Code plugin for keeping [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) knowledge bases inside one repo. Source: `plugins/knowledge-base`, `packages/knowledge-base-cli` and `packages/knowledge-base`.

## Model

- A **base** is a `docs/` directory whose `index.md` carries `okf_version`. It also has a `log.md` and concept docs, each with a `type` in its frontmatter.
- A repo can hold **many bases**, for example one at the root and one per package in a large Java project.
- Bases are **found by scanning**. Nothing stores a list of them. The scan uses git's file list (tracked files plus untracked files that are not ignored), so build output such as `target/` is skipped. Outside git it walks the directory and skips common build and dependency folders. Either way a nested repo or linked worktree, such as `.claude/worktrees/<name>`, is never searched: git lists it as one entry and the walk skips any directory with its own `.git`.
- **Ownership is by nearest ancestor.** Knowledge about a piece of code belongs in the closest `docs/` base walking up from that code. Everything else falls to the base at the repo root. The walk stops at the root of the repo or worktree that holds the file, so a file in a worktree is never owned by a base of the main checkout around it.
- The plugin never looks outside the current repo. Knowledge that spans repos is Globu's job.

Every base carries its own authoring guide inside `index.md`, between `knowledge-base:authoring-guide` markers. An agent or person without the plugin can read it and edit the base correctly. When an `index.md` has no markers yet, `setup` inserts the guide after the title and its intro. The intro is the whole first paragraph, and only when that paragraph is prose: a heading, a list, a table or a comment straight after the title is left below the guide. One case is not handled: an intro on the very last line of a file with no final newline is not seen as an intro, and the guide goes above it.

## CLI

Published as `@mercastra/knowledge-base` and built to `packages/knowledge-base-cli/dist/knowledge-base.mjs`. Add `--json` to any command. `--help` works on the program and on every command.

| Command | Purpose |
|---|---|
| `setup [path] [--name] [--description]` | Create a base or upgrade one in place. Idempotent. |
| `validate [path]` | Structural check of one base or of every base under a directory. Exit code 1 on errors. |
| `bases [path]` | List every base under a directory. |
| `owner <file>` | Print the base that owns a file. |
| `log <docsDir> <YYYY-MM-DD> <entry...>` | Add entries to a base's `log.md`, newest first. |
| `hook validate-edit` | Hook entry point. |

`setup` only ever changes two things in an existing `index.md`: required frontmatter keys (`okf_version`, `name`, `knowledge_base_version`) and the authoring guide block.

## Hook

`PostToolUse` on `Edit` and `Write`. When the edited file is a Markdown file inside a base, the base is validated straight away. Errors are returned to Claude with exit code 2 so it can correct them in the same session.

## Skills

- `setup`: runs the command above and drafts a description for new bases.
- `update-knowledge`: summarizes the session, routes each item to its owning base, writes the edits, logs them and validates. It works on the current repo, or on an explicit list of base directories when another skill passes one. That list is how Globu hands it targets. Edits stay in the working tree.

## Not built yet

- A CI check (structural validation plus an optional model-based content review), delivered as a GitHub Action.
- Link checking inside a base.
