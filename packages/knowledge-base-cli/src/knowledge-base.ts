import path from "node:path";
import { command, type Io, type JsonOption, print, readHookInput, runCli } from "../../cli-common/src/index.js";
import {
  appendLog,
  findBases,
  isInside,
  ownerBase,
  setupBase,
  VERSION,
  validateBase,
  validateRepo
} from "../../knowledge-base/src/index.js";

const PROGRAM = {
  name: "knowledge-base",
  description: "Manage OKF knowledge bases (docs/ directories) inside one repo.",
  version: VERSION
};

function rel(io: Io, target: string): string {
  return path.relative(io.cwd, target) || ".";
}

function target(io: Io, positional: string | undefined): string {
  return path.resolve(io.cwd, positional ?? ".");
}

export function knowledgeBaseMain(argv: string[], io: Io): number {
  return runCli(
    PROGRAM,
    (program, exit) => {
      command(program, "setup [path]", "bootstrap a base or upgrade one in place")
        .option("--name <name>", "name of the base")
        .option("--description <text>", "one sentence describing the base")
        .action((dir: string | undefined, options: JsonOption & { name?: string; description?: string }) => {
          const summary = setupBase(target(io, dir), { name: options.name, description: options.description });
          const lines = [
            `base: ${rel(io, summary.docsDir)}`,
            ...summary.created.map((file) => `  created   ${rel(io, file)}`),
            ...summary.updated.map((file) => `  updated   ${rel(io, file)}`),
            ...summary.unchanged.map((file) => `  unchanged ${rel(io, file)}`),
            ...summary.validation.errors.map((err) => `  invalid   ${rel(io, err.file)}: ${err.message}`)
          ];
          print(io, options.json, summary, lines.join("\n"));
          if (summary.validation.errors.length > 0) exit(1);
        });

      command(program, "validate [path]", "check the OKF structure of every base under a directory").action(
        (dir: string | undefined, options: JsonOption) => {
          const { results, errors } = validateRepo(target(io, dir));
          const lines =
            results.length === 0
              ? errors.map((err) => `${rel(io, err.file)}: ${err.message}`)
              : results.flatMap((result) => [
                  `${result.errors.length === 0 ? "OK  " : "FAIL"}  ${rel(io, result.docsDir)}`,
                  ...result.errors.map((err) => `      ${rel(io, err.file)}: ${err.message}`)
                ]);
          print(io, options.json, { results, errors }, lines.join("\n"));
          if (errors.length > 0) exit(1);
        }
      );

      command(program, "bases [path]", "list every base under a directory").action(
        (dir: string | undefined, options: JsonOption) => {
          const bases = findBases(target(io, dir));
          const lines = bases.map((base) => `${base.name}\t${rel(io, base.docsDir)}`);
          print(io, options.json, bases, lines.join("\n") || "no OKF bases found");
        }
      );

      command(program, "owner <file>", "show which base owns a file").action(
        (filePath: string, options: JsonOption) => {
          const file = path.resolve(io.cwd, filePath);
          const docsDir = ownerBase(file);
          print(io, options.json, { file, docsDir }, docsDir === null ? "no owning base" : rel(io, docsDir));
          if (docsDir === null) exit(1);
        }
      );

      command(
        program,
        "log <docsDir> <date> <entries...>",
        "add entries to a base's log.md under a YYYY-MM-DD date"
      ).action((docsDir: string, date: string, entries: string[], options: JsonOption) => {
        const logPath = appendLog(path.resolve(io.cwd, docsDir), date, entries);
        print(io, options.json, { logPath }, `updated ${rel(io, logPath)}`);
      });

      program
        .command("hook")
        .description("hook entry points for Claude Code")
        .command("validate-edit")
        .description("PostToolUse entry point: validate the base that owns the edited file")
        .action(() => {
          const filePath = readHookInput(io)?.tool_input.file_path;
          if (!filePath?.endsWith(".md")) return;
          const file = path.resolve(io.cwd, filePath);
          const docsDir = ownerBase(file);
          if (docsDir === null || !isInside(docsDir, file)) return;
          const { errors } = validateBase(docsDir);
          if (errors.length === 0) return;
          const lines = errors.map((err) => `  ${err.file}: ${err.message}`);
          io.err(`knowledge-base: ${docsDir} failed validation after this edit:\n${lines.join("\n")}`);
          exit(2);
        });
    },
    argv,
    io
  );
}
