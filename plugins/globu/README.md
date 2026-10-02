# globu

Claude Code plugin that gives Claude a per-user registry of knowledge shards.

- A session hook tells Claude which shards exist on this machine and when to consult them.
- A guard hook blocks edits to read-only shards.
- `/globu:register` adds a shard and drafts its routing text.
- `/globu:save-knowledge` writes what a session learned to the right shard.

See [docs/globu-cli.md](../../docs/globu-cli.md) and [docs/architecture.md](../../docs/architecture.md).
