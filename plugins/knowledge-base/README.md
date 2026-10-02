# knowledge-base

Claude Code plugin that keeps [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) knowledge bases inside one repo. It works on its own and does not need Globu.

- `/knowledge-base:setup [path]` bootstraps or upgrades a `docs/` base.
- `/knowledge-base:update-knowledge` records what a session learned in the repo's bases.
- A hook validates a base right after Claude edits a file in it.

See [docs/knowledge-base-plugin.md](../../docs/knowledge-base-plugin.md).
