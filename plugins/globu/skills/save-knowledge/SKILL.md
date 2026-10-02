---
name: save-knowledge
description: Record what the current session learned in the right Globu shard. Use when the user asks to save, persist or write down what was learned, or at the end of a successful task that produced durable knowledge, whenever Globu shards are registered. Takes precedence over single-repo knowledge skills because it chooses between shards first.
---

# Save knowledge

Decides which shard each piece of knowledge belongs in, checks that it may be written and then writes it using that shard's own conventions. The CLI is installed with this plugin at `node_modules/@mercastra/globu/dist/globu.mjs` in the plugin root (two directories above this file).

## Workflow

1. **Summarize the session.** List what was learned or decided: facts, decisions, API shapes, gotchas, root causes, repeatable procedures. If nothing is durable, say so and stop.

2. **List the active shards.**
   ```bash
   node <plugin-root>/node_modules/@mercastra/globu/dist/globu.mjs list --json
   ```
   Each shard has `id`, `path`, `mode`, `format`, `roots`, `description` and `useWhen`.

3. **Choose a target for every item, explicitly.** There is no default shard.
   - Match each item against `description` and `useWhen`.
   - Knowledge about the code of the repo you are working in belongs in that repo's own base, whether or not it is a shard.
   - Personal or confidential material goes only to a shard the user owns privately. Never move it into a shared shard.
   - If an item fits no shard, or fits more than one, ask the user. Do not guess.

4. **State the plan before writing**: each item and the shard it will go to. If any target is a shared shard, or the user has not seen this routing before, wait for confirmation.

5. **Check access.** Only shards with `mode: "write"` can be edited. For a read-only shard, tell the user what you would have written and stop there for that item.

6. **Write, per shard, using its format.**
   - `okf`: if the `knowledge-base:update-knowledge` skill is available, invoke it with the target base directories (the shard `path` joined with each relevant root `path`). Otherwise read the root's `index.md`, follow the authoring guide in it and add a dated entry to `log.md`.
   - `generic`: follow the conventions the existing files already use. Keep the change small and say what you changed.

7. **Report** what was written where, and what was skipped and why.

## Guardrails

- Leave edits in the working tree. Do not commit, branch or push unless the user asks.
- Name the target shard for every write. Never write to a shard just because you happened to be reading it.
- Do not add links from a shared shard to a private one.
