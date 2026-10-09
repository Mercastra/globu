# globu-status

A Claude Code mod that shows how much the current session has done since its knowledge was last updated, so a glance tells whether a knowledge update is due.

## What it shows

A minimal status line under the prompt, labelled `globu-status` by the engine (the label cannot be hidden, the text is all a mod controls there):

- `○ nothing to update`: fresh session.
- `◔ low`, `◑ medium`, `● strong`: something is pending.
- `updating...` while the update skill runs, then `✓ up to date`.

While something is pending a band above the prompt adds the detail, `◔ Low need to update knowledge (2 edits, 1 turn)` in green, yellow or red, with `Update knowledge` (hotkey k), which submits `/globu:update-knowledge` (falling back to `/knowledge-base:update-knowledge`, then `/globu:save-knowledge`, then a plain prompt), `Mark up to date` (hotkey m) and `Hide for a week` (hotkey h). Pressing `Update knowledge` turns the band into `Updating knowledge...` at once, without buttons. Nothing counts while the update runs, and when its turn ends the band disappears. An interrupted update brings the need back. The band also disappears once the knowledge is up to date by any other route. A hide is kept across sessions in the plugin store; `/globu-status show` lifts it early and `/globu-status` says until when it holds.

## How it scores

Each distinct file edited with Edit, Write or NotebookEdit and each shell command that writes a file counts one. Each completed turn that made such a change counts one. A `git commit` counts five, but only while something is pending, so a commit that ships the knowledge update does not raise the need again. Edits under tmp, scratchpad, node_modules, dist or .git are ignored.

Levels: 0 is none, under 4 is low, under 9 is medium, otherwise strong. Any commit is at least medium.

## What counts as an update

- Invoking an update skill: `globu:update-knowledge`, `knowledge-base:update-knowledge` or the older `globu:save-knowledge`.
- Editing a Markdown file inside an OKF base (a folder, or an ancestor, holding both `index.md` and `log.md`).
- Running `globu base log` or `globu base validate` (or the older `knowledge-base log` and `validate`).
- The end of the turn started by `Update knowledge`.
- Pressing `Mark up to date` or typing `/globu-status reset`.

`/globu-status` prints the current state.

## Install elsewhere

Copy this folder into a repository with a `.claude-plugin/marketplace.json` listing it, then:

```
/plugin install globu-status --marketplace <owner>/<repo>
```

For development, `claude --plugin-dir <path to this folder>` loads it for one session.
