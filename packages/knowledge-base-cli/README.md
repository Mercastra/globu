# @mercastra/knowledge-base

Command line program for keeping [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) knowledge bases (`docs/` directories) inside one repo: bootstrap them, validate them and log changes.

```sh
npm install -g @mercastra/knowledge-base
knowledge-base --help
```

The knowledge-base plugin for Claude Code installs this package for its hook and skills. The program never prompts, and every command accepts `--json`.
