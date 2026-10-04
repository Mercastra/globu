# Knowledge base update log

## 2026-10-04
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
