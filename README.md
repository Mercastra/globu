# Globu

Globu joins your knowledge bases and plugs into Claude Code so Claude can find the right knowledge for a task and write new knowledge back after a session.

This repo ships two Claude Code plugins that install separately:

- **[knowledge-base](plugins/knowledge-base/README.md)** keeps [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) knowledge bases (`docs/` directories) inside one repo. It works on its own.
- **[globu](plugins/globu/README.md)** is a per-user registry of knowledge shards. It tells Claude which knowledge exists on this machine, when to consult it and where it may write.

## Try it locally

```sh
npm install
npm run build
claude --plugin-dir ./plugins/knowledge-base --plugin-dir ./plugins/globu
```

The CLIs can also be run directly:

```sh
node packages/globu-cli/dist/globu.mjs help
node packages/knowledge-base-cli/dist/knowledge-base.mjs help
```

## Development

```sh
nvm use
npm install
npm run verify
```

`npm run verify` runs lint, typecheck, the build and the tests with a 100% coverage gate. The pre-commit hook and CI run the same command. See [docs/development.md](docs/development.md).

`npm run build` bundles each CLI into its package's `dist/` directory and links it into the matching plugin. The bundles are not kept in git: the CLIs are published to npm as `@mercastra/globu` and `@mercastra/knowledge-base`, and each plugin depends on its CLI at a pinned version. See [docs/development.md](docs/development.md#releasing).

## Documentation

Design and reference docs live in [`docs/`](docs/index.md), which is itself an OKF base maintained with these tools.
