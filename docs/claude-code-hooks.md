---
type: "Reference"
title: "Claude Code hook contract"
description: "The Claude Code hook behaviours Globu's session and guard hooks rely on, where each is documented and which ones are still untested."
---

# Claude Code hook contract

Globu's two hooks depend on how Claude Code runs hooks. This page lists what they rely on, so a change in Claude Code can be checked against one place. Everything under "Relied on" was read in the Claude Code docs on 2026-10-05. Nothing here was tested against a live permission prompt.

Sources: the [hooks reference](https://code.claude.com/docs/en/hooks), [permissions](https://code.claude.com/docs/en/permissions), [permission modes](https://code.claude.com/docs/en/permission-modes), [headless mode](https://code.claude.com/docs/en/headless) and [worktrees](https://code.claude.com/docs/en/worktrees).

## Relied on

| Behaviour | Used by |
|---|---|
| Hook input arrives as JSON on stdin with `cwd` and, for tool events, `tool_input`. `Edit` and `Write` carry `file_path`, `NotebookEdit` carries `notebook_path` and `Bash` carries `command`. | both hooks, parsed in `packages/cli-common/src/run.ts` |
| `cwd` is the directory Claude is working in. In a worktree session it is the worktree root, and it moves when Claude runs `cd`. | the index and `list` use it to find the session's worktree |
| `CLAUDE_PROJECT_DIR` is exported to the hook process and stays at the directory the session started in, also after `cd` and after entering a worktree. | the guard uses it as the session's home |
| A PreToolUse hook that exits 2 blocks the tool call and Claude reads stderr as the reason. JSON on stdout cannot override it. | the guard, for `read` shards |
| A PreToolUse hook that exits 0 and prints `hookSpecificOutput.permissionDecision: "ask"` makes Claude Code prompt the user. `permissionDecisionReason` is shown in that prompt, labelled `[plugin:globu]`. | the guard, for `ask` shards and possible writes |
| When several hooks disagree, precedence is `deny`, then `defer`, then `ask`, then `allow`. | the guard can only tighten what another hook allows |
| A hook's `ask` also forces the prompt in auto mode. In a `-p` run with nobody to answer, the call is denied and Claude reads the reason. | `ask` shards stay protected in unattended runs |
| `acceptEdits` approves edits inside the working directory and inside `permissions.additionalDirectories` without a prompt. | this is why `ask` exists: after `globu claude sync` a sibling shard would otherwise be edited silently |
| Top-level `decision` and `reason` are deprecated for PreToolUse. | the guard prints `hookSpecificOutput` only |

## Not settled

Neither point is answered by the docs, and neither was tested:

- Whether "don't ask again" for the session silences later prompts raised by the hook. If it does, an `ask` shard prompts once per session. If not, it prompts on every edit.
- Whether a hook's `ask` still prompts under `bypassPermissions`.

Test both with a sibling repo in `ask` mode before relying on the mode for a rule that must hold.

## Cost

The guard runs before every `Edit`, `Write`, `NotebookEdit` and `Bash` call. A call takes about 50 ms, most of it Node starting. It returns before any git process runs when no shard is in `read` or `ask` mode.
