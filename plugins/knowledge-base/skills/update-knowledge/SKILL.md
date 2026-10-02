---
name: update-knowledge
description: Record what the current session learned in the OKF knowledge bases of the current repo. Use when the user asks to save, persist or write down what was just discussed, or before treating a task as finished in a repo that has a docs/ base, if the task produced something durable (a decision, an API shape, a gotcha, a root cause). Also accepts an explicit list of base directories to update.
---

# Update knowledge

Reviews the session and updates the OKF bases the new knowledge belongs to. The scope is the current repo, unless the caller passes explicit base directories.

The CLI is installed with this plugin at `node_modules/@mercastra/knowledge-base/dist/knowledge-base.mjs` in the plugin root (two directories above this file).

## Workflow

1. **Pick the candidate bases.**
   - If you were given explicit base directories (arguments to this skill, or a list from another skill), use exactly those and skip the scan.
   - Otherwise list the bases in the current repo:
     ```bash
     node <plugin-root>/node_modules/@mercastra/knowledge-base/dist/knowledge-base.mjs bases --json
     ```
   - If there are none, tell the user and stop. Offer the `setup` skill.

2. **Summarize the session.** Before touching files, list what was actually learned or decided: facts, decisions, API shapes, gotchas, root causes. If nothing is durable, say so and stop.

3. **Route each item to its owning base.** Knowledge about a piece of code belongs in the nearest base walking up from that code. To check a specific file:
   ```bash
   node <plugin-root>/node_modules/@mercastra/knowledge-base/dist/knowledge-base.mjs owner <path-to-code-file>
   ```
   Cross-cutting knowledge with no single owner goes to the base at the repo root.

4. **Read before writing.** For each target base, read `index.md` (it carries the authoring guide) and skim the existing concept docs. Prefer editing an existing doc over creating a near-duplicate.

5. **Write the edits** with your normal file tools:
   - New concept docs need frontmatter with a non-empty `type`, plus `title` and `description`.
   - Use `type: "Playbook"` for a repeatable procedure: the steps, the gotchas and the links needed to do the task again unaided.
   - Add new docs to the Contents list in `index.md`.
   - Record the change in the log:
     ```bash
     node <plugin-root>/node_modules/@mercastra/knowledge-base/dist/knowledge-base.mjs log <docsDir> <YYYY-MM-DD> "<entry>" ["<entry>" ...]
     ```

6. **Validate.**
   ```bash
   node <plugin-root>/node_modules/@mercastra/knowledge-base/dist/knowledge-base.mjs validate <docsDir>
   ```
   Fix any errors before finishing.

7. **Report** which bases changed and which files were touched.

## Guardrails

- Leave the edits in the working tree. Do not commit, branch or push unless the user asks. In a code repo the knowledge change normally ships in the same commit as the code change.
- Do not force an update onto a base the session has nothing to say about.
- Never write to a base outside the current repo unless its directory was passed to you explicitly.
