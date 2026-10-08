import path from "node:path";
import { Option } from "commander";
import {
  type Access,
  commandTargets,
  DEFAULT_IMPORT_FILE,
  doctor,
  guardVerdict,
  type ImportPlan,
  type ImportResult,
  importManifests,
  locate,
  type Mode,
  type RefResult,
  type ResolvedShard,
  register,
  removeContext,
  renderIndex,
  reprobe,
  resolveActive,
  resolveAll,
  resolveRefs,
  type SessionShard,
  sessionHome,
  setContext,
  sync,
  syncClaudeDirectories,
  unregister,
  updateShard,
  useContext,
  type Verdict
} from "../../globu-core/src/index.js";
import { VERSION } from "../../knowledge-base/src/index.js";
import { defineBaseCommands, validateEditHook } from "./base.js";
import { command, type Io, type JsonOption, print, readHookInput, runCli } from "./cli/index.js";

const PROGRAM = {
  name: "globu",
  description: "Knowledge bases and a knowledge registry for Claude Code.",
  version: VERSION
};

const FOOTER = `
Config lives in ~/.globu (override with GLOBU_HOME). GLOBU_CONTEXT overrides the active context for one process.
GLOBU_GIT_TOKEN makes the clones globu makes and pulls go over https with that token.`;

const MODES: Mode[] = ["read", "ask", "write"];
const ACCESS: Access[] = ["read", "write"];

function choiceOption(flags: string, description: string, choices: string[]): Option {
  return new Option(flags, description).choices(choices);
}

function location(shard: ResolvedShard): string {
  if (shard.path === null) return "(not synced)";
  return shard.present ? shard.path : `${shard.path} (missing)`;
}

function listLine(shard: SessionShard): string {
  const session = shard.workPath === shard.path ? [] : [`this session: ${shard.workPath}`];
  return [shard.id, shard.format, shard.mode, location(shard), ...session].join("\t");
}

function shardDetails(shard: ResolvedShard): string {
  return [
    `id:          ${shard.id}`,
    `repo:        ${shard.source.repo ?? "(local only)"}`,
    `format:      ${shard.format}`,
    `mode:        ${shard.mode}${shard.access === "read" ? " (capped by manifest)" : ""}`,
    `path:        ${location(shard)}`,
    `owner:       ${shard.owner ?? "-"}`,
    `description: ${shard.description || "-"}`,
    `use when:    ${shard.useWhen || "-"}`,
    "roots:",
    ...shard.roots.map((root) => `  ${root.path}${root.entry === undefined ? "" : ` (entry: ${root.entry})`}`)
  ].join("\n");
}

function guardReason({ decision, shard, target }: Verdict, viaCommand: boolean): string {
  const subject = viaCommand
    ? `this command ${target.certain ? "writes to" : "may change"} ${target.path}, which belongs to shard "${shard.id}". That shard`
    : `${target.path} belongs to shard "${shard.id}", which`;
  if (decision === "deny") {
    return `globu: ${subject} is read-only on this machine. Do not edit it. If the user wants it editable, they can run \`globu set ${shard.id} --mode write\` (user-owned clones only).`;
  }
  if (shard.mode === "read") {
    return `globu: ${subject} is read-only on this machine. Approve only if the command does not modify it.`;
  }
  return `globu: ${subject} asks before edits from sessions in other repos. Approve only if you want this session to change it.`;
}

function importPlanLines(plan: ImportPlan): string[] {
  return [
    `${plan.source}${plan.file === null ? "" : ` (${plan.file})`}`,
    `  added:    ${plan.added.join(", ") || "-"}`,
    `  updated:  ${plan.updated.join(", ") || "-"}`,
    `  contexts: ${plan.contexts.join(", ") || "-"}`
  ];
}

function importText(result: ImportResult): string {
  const lines = result.plans.flatMap(importPlanLines);
  if (result.context !== null) lines.push(`active context: ${result.context}`);
  if (!result.applied) {
    lines.push("nothing written, run again with --yes to apply");
  } else {
    lines.push(`written to ${result.manifestPath}`);
    if (result.plans.some((plan) => plan.added.length > 0)) lines.push("next: `globu sync` clones the new shards");
  }
  return lines.join("\n");
}

function refLine(result: RefResult): string {
  return result.ok ? `ok\t${result.ref}\t${result.location}` : `fail\t${result.ref}\t${result.reason}`;
}

const UNREGISTER_SUFFIX = { none: "", kept: ", clone left in place", removed: ", clone removed" };

export function globuMain(argv: string[], io: Io): number {
  return runCli(
    PROGRAM,
    (program, exit) => {
      program.addHelpText("after", FOOTER);

      command(program, "register <locator>", "register a git repo as a shard, from a local path or a repo URL")
        .option("--id <id>", "shard id, defaults to the repo name")
        .addOption(choiceOption("--mode <mode>", "whether this machine may edit the shard", MODES))
        .option("--path <dir>", "where to clone a repo URL, or where its clone already is")
        .option("--description <text>", "what the shard contains")
        .option("--use-when <text>", "when Claude should consult the shard")
        .action(
          (
            locator: string,
            options: JsonOption & { id?: string; mode?: Mode; path?: string; description?: string; useWhen?: string }
          ) => {
            const result = register({
              locator,
              cwd: io.cwd,
              id: options.id,
              mode: options.mode,
              dest: options.path,
              description: options.description,
              useWhen: options.useWhen
            });
            const lines = [`${result.action} ${result.shard.id}`, shardDetails(result.shard)];
            if (!result.portable) {
              lines.push("note: this repo has no origin remote, so other machines cannot sync it");
            }
            if (!result.shard.description || !result.shard.useWhen) {
              lines.push(
                `note: add routing text with \`globu set ${result.shard.id} --description ... --use-when ...\``
              );
            }
            print(io, options.json, result, lines.join("\n"));
          }
        );

      command(program, "unregister <id>", "remove a shard from the manifest and the local state")
        .option("--purge", "also delete a clone that globu owns")
        .action((id: string, options: JsonOption & { purge?: boolean }) => {
          const result = unregister(id, options.purge === true);
          print(io, options.json, result, `unregistered ${result.id}${UNREGISTER_SUFFIX[result.clone]}`);
        });

      command(program, "list", "list the shards in the active context")
        .option("--all", "list every shard, whatever the active context")
        .action((options: JsonOption & { all?: boolean }) => {
          const { context, shards: resolved } = options.all ? { ...resolveAll(), context: null } : resolveActive();
          const shards = locate(resolved, io.cwd);
          const lines = shards.map(listLine);
          if (lines.length === 0) lines.push("no shards registered");
          if (context !== null) lines.unshift(`context: ${context}`);
          print(io, options.json, { context, shards }, lines.join("\n"));
        });

      command(program, "show <id>", "show everything known about one shard").action(
        (id: string, options: JsonOption) => {
          const shard = resolveAll().shards.find((candidate) => candidate.id === id);
          if (!shard) throw new Error(`no shard registered with id "${id}"`);
          print(io, options.json, shard, shardDetails(shard));
        }
      );

      command(program, "set <id>", "edit a shard's routing text, local mode or access cap")
        .option("--description <text>", "what the shard contains")
        .option("--use-when <text>", "when Claude should consult the shard")
        .addOption(choiceOption("--mode <mode>", "whether this machine may edit the shard", MODES))
        .addOption(choiceOption("--access <access>", "the most any machine may do with the shard", ACCESS))
        .action(
          (
            id: string,
            options: JsonOption & { description?: string; useWhen?: string; mode?: Mode; access?: Access }
          ) => {
            const shard = updateShard(id, {
              description: options.description,
              useWhen: options.useWhen,
              mode: options.mode,
              access: options.access
            });
            print(io, options.json, shard, shardDetails(shard));
          }
        );

      command(program, "reprobe <id>", "detect a shard's format and roots again").action(
        (id: string, options: JsonOption) => {
          const result = reprobe(id);
          print(io, options.json, result, `${result.changed ? "updated" : "unchanged"}\n${shardDetails(result.shard)}`);
        }
      );

      command(program, "sync", "clone missing shards and update the existing clones").action((options: JsonOption) => {
        const report = sync();
        const lines = report.map((entry) => [entry.action, entry.id, ...(entry.error ? [entry.error] : [])].join("\t"));
        print(io, options.json, report, lines.join("\n") || "no shards registered");
        if (report.some((entry) => entry.action === "error")) exit(1);
      });

      command(program, "import [locator]", "merge a team manifest into this machine's manifest")
        .option("--file <path>", `the manifest inside a repo or directory, default ${DEFAULT_IMPORT_FILE}`)
        .option("--context <name>", "make this context active once the import is written")
        .option("--yes", "write the merged manifest; without it the command only shows what would change")
        .action(
          (locator: string | undefined, options: JsonOption & { file?: string; context?: string; yes?: boolean }) => {
            const result = importManifests({
              locator,
              file: options.file,
              context: options.context,
              apply: options.yes === true,
              cwd: io.cwd
            });
            print(io, options.json, result, importText(result));
          }
        );

      command(program, "use [context]", "make a context active for new sessions")
        .option("--all", "clear the active context so every shard is active")
        .action((context: string | undefined, options: JsonOption & { all?: boolean }) => {
          const selected = options.all ? null : context;
          if (selected === undefined) throw new Error("use needs a context name, or --all");
          const name = useContext(selected);
          print(io, options.json, { current: name }, `active context: ${name ?? "all shards"}`);
        });

      const context = program.command("context").description("define and inspect contexts");

      command(context, "list", "show the contexts and which one is active").action((options: JsonOption) => {
        const { manifest, state } = resolveAll();
        const lines = Object.entries(manifest.contexts).map(
          ([name, selection]) => `${name === state.current ? "*" : " "} ${name}\t${selection.join(" ")}`
        );
        const text = lines.join("\n") || "no contexts defined, every shard is active";
        print(io, options.json, { current: state.current, contexts: manifest.contexts }, text);
      });

      command(
        context,
        "set <name> <patterns...>",
        "define a context from shard ids or patterns, * is a wildcard"
      ).action((name: string, patterns: string[], options: JsonOption) => {
        print(io, options.json, setContext(name, patterns), `context ${name}: ${patterns.join(" ")}`);
      });

      command(context, "rm <name>", "delete a context").action((name: string, options: JsonOption) => {
        print(io, options.json, removeContext(name), `removed context ${name}`);
      });

      command(program, "index", "print the text the session hook injects").action((options: JsonOption) => {
        const { shards, context: active } = resolveActive();
        const index = renderIndex(shards, active, io.cwd);
        print(io, options.json, { context: active, index }, index);
      });

      command(program, "resolve <refs...>", "check that references exist on their repo's default branch").action(
        (refs: string[], options: JsonOption) => {
          const { shards: active, context: activeContext } = resolveActive();
          const report = resolveRefs(refs, resolveAll().shards, active, io.cwd, activeContext);
          const touched = active.filter((shard) => report.shards.includes(shard.id));
          const index = renderIndex(touched, activeContext, io.cwd);
          const lines = report.refs.map(refLine);
          if (index) lines.push("", index);
          print(io, options.json, { ...report, context: activeContext, index }, lines.join("\n"));
          if (!report.ok) exit(1);
        }
      );

      command(program, "doctor", "report problems with the registered shards").action((options: JsonOption) => {
        const findings = doctor();
        const lines = findings.map((finding) => `${finding.level}\t${finding.id}\t${finding.message}`);
        print(io, options.json, findings, lines.join("\n") || "no problems found");
        if (findings.some((finding) => finding.level === "error")) exit(1);
      });

      const claude = program.command("claude").description("integrate with Claude Code settings");

      command(claude, "sync", "add the active shards' paths to permissions.additionalDirectories")
        .option("--remove", "remove the paths globu added")
        .action((options: JsonOption & { remove?: boolean }) => {
          const result = syncClaudeDirectories(options.remove === true);
          const lines = [`${result.changed ? "updated" : "unchanged"} ${result.settingsPath}`, ...result.directories];
          print(io, options.json, result, lines.join("\n"));
        });

      defineBaseCommands(program.command("base").description("OKF knowledge bases inside the current repo"), io, exit);

      const hook = program.command("hook").description("hook entry points for Claude Code");

      hook
        .command("session-start")
        .description("SessionStart entry point: print the shard index")
        .action(() => {
          const cwd = readHookInput(io)?.cwd ?? io.cwd;
          try {
            const { shards, context: active } = resolveActive();
            const index = renderIndex(shards, active, cwd);
            if (index) io.out(index);
          } catch (err) {
            io.out(`Globu could not load its shard index: ${(err as Error).message}`);
          }
        });

      hook
        .command("validate-edit")
        .description("PostToolUse entry point: validate the base that owns the edited file")
        .action(() => validateEditHook(io, exit));

      hook
        .command("guard")
        .description("PreToolUse entry point: block or ask before changes to read-only and ask shards")
        .action(() => {
          const input = readHookInput(io);
          const cwd = input?.cwd ?? io.cwd;
          const filePath = input?.tool_input.file_path ?? input?.tool_input.notebook_path;
          const command = input?.tool_input.command ?? "";
          const targets =
            filePath === undefined
              ? commandTargets(command, cwd)
              : [{ path: path.resolve(cwd, filePath), certain: true }];
          let verdict: Verdict | null;
          try {
            verdict = guardVerdict(resolveAll().shards, targets, sessionHome(cwd));
          } catch {
            return;
          }
          if (verdict === null) return;
          const reason = guardReason(verdict, filePath === undefined);
          if (verdict.decision === "deny") {
            io.err(reason);
            exit(2);
            return;
          }
          io.out(
            JSON.stringify({
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "ask",
                permissionDecisionReason: reason
              }
            })
          );
        });
    },
    argv,
    io
  );
}
