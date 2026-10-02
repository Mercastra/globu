# @mercastra/globu

Command line program for Globu, a per-user registry of knowledge shards for Claude Code. It tells Claude which knowledge exists on this machine, when to consult it and where it may write.

```sh
npm install -g @mercastra/globu
globu --help
```

The Globu plugin for Claude Code installs this package for its hooks and skills. The program never prompts, and every command accepts `--json`.
