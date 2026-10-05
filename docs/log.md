# Knowledge base update log

## 2026-10-05
* `setup` now inserts the authoring guide after the whole intro paragraph and never takes a heading, list, table or comment for the intro. It used to split a hard-wrapped intro after its first line. Noted the placement rule in [knowledge-base plugin](./knowledge-base-plugin.md).
* The guard now also runs before `Bash` and reads the command: redirects and file commands are certain writes, other commands possible ones, and commands that only read pass. Added the rules and their limits to [architecture](./architecture.md), updated [globu CLI](./globu-cli.md) and recorded the reasons in [decisions](./decisions.md).
* Shards are now matched by git repo, not by path prefix. A session in any linked worktree gets that worktree in the index, in `list` and in the guard, and `register` always records the main checkout. Added the session view to [architecture](./architecture.md), updated [globu CLI](./globu-cli.md) and recorded the reasons in [decisions](./decisions.md).
* Added the local mode `ask`: the guard returns the PreToolUse decision `ask` for edits from sessions in other repos and stays silent for the shard's own sessions. Updated [architecture](./architecture.md), [globu CLI](./globu-cli.md) and [decisions](./decisions.md).
* The knowledge-base scan no longer searches nested repos or worktrees when it walks without git, and `owner` stops at the root of the repo or worktree. Updated [knowledge-base plugin](./knowledge-base-plugin.md).
* Added the cloud session and teammate discovery use case to the open question on importing manifests in [decisions](./decisions.md).

## 2026-10-04
* Chose the MIT licence and recorded it in [decisions](./decisions.md). Development and CI moved to Node 26.
* The release workflow now waits until the published tarballs can be downloaded before it commits the pin and moves stable. Updated [development](./development.md).
* Removed the roadmap doc and the status note in the README. Older log entries keep the word but no longer link to it.
* Raised the runtime floor of the bundled CLIs from Node 20 to Node 22 and moved to commander 15. Updated [development](./development.md).
* Split the cli package into globu-cli and knowledge-base-cli with a shared cli-common, and renamed okf to knowledge-base and core to globu-core. Updated [architecture](./architecture.md), [decisions](./decisions.md) and [development](./development.md).
* Moved both CLIs to commander. Help text is generated, usage errors come from commander and bare `globu context` no longer defaults to `list`. Updated [globu CLI](./globu-cli.md), [knowledge-base plugin](./knowledge-base-plugin.md) and [development](./development.md).
* Stopped committing the CLI bundles. The CLIs are published to npm, each plugin pins its CLI through a lockfile written by `npm run pin` and the marketplace installs plugins from the `stable` branch. Added the distribution section to [architecture](./architecture.md), the release steps to [development](./development.md) and the reasons to [decisions](./decisions.md).

## 2026-10-02
* Renamed the standalone plugin from okf-base to knowledge-base: plugin directory, CLI, skills, hook, authoring guide markers and [knowledge-base plugin](./knowledge-base-plugin.md). Replaced the index frontmatter key bootstrapped_by with knowledge_base_version. Recorded both in [decisions](./decisions.md).
* Tests now drop every GIT_* environment variable, so running them from a git hook in a worktree cannot touch the real repository. Noted in [development](./development.md).
* Removed the comment check script. Comments are now a convention: none by default, only critical ones allowed. Updated [development](./development.md), [decisions](./decisions.md), [architecture](./architecture.md) and roadmap.
* Renamed the manifest key `use_when` to `useWhen`.
* Added [development](./development.md): tooling, quality gates, tests and CI. Updated [architecture](./architecture.md), [decisions](./decisions.md) and roadmap for the move to TypeScript and the simpler driver interface.
* Created this base with `knowledge-base setup`.
* Added [architecture](./architecture.md), [knowledge-base plugin](./knowledge-base-plugin.md), [globu CLI](./globu-cli.md), [design decisions](./decisions.md) and roadmap alongside the first implementation of both products.
