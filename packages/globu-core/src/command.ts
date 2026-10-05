import os from "node:os";
import path from "node:path";
import { parseCommands } from "./shell.js";

export type Target = { path: string; certain: boolean };

type Variables = Map<string, string>;

const PREFIXES = new Set(["if", "then", "else", "elif", "do", "while", "until", "!", "{", "}", "time", "export"]);
const READERS = new Set([
  ":",
  "[",
  "awk",
  "basename",
  "case",
  "cat",
  "cmp",
  "cut",
  "date",
  "df",
  "diff",
  "dirname",
  "done",
  "du",
  "echo",
  "esac",
  "exit",
  "false",
  "fi",
  "file",
  "find",
  "for",
  "grep",
  "head",
  "jq",
  "less",
  "ls",
  "more",
  "popd",
  "printf",
  "pwd",
  "readlink",
  "realpath",
  "return",
  "rg",
  "sed",
  "set",
  "sleep",
  "sort",
  "stat",
  "tail",
  "test",
  "tr",
  "tree",
  "true",
  "type",
  "uniq",
  "unset",
  "wait",
  "wc",
  "which"
]);
const UNSAFE_FLAGS = new Map([
  ["find", /^-(delete|exec|execdir|ok|okdir|fprint|fls)/],
  ["sed", /^(-[a-zA-Z]*i|--in-place)/],
  ["sort", /^(-o|--output)/]
]);
const WRITERS = new Set(["mkdir", "mv", "rm", "rmdir", "tee", "touch", "truncate"]);
const LAST_ARG_WRITERS = new Set(["cp", "ln"]);
const SHELLS = new Set(["bash", "sh", "zsh"]);
const GIT_READERS = new Set([
  "blame",
  "cat-file",
  "describe",
  "diff",
  "diff-tree",
  "for-each-ref",
  "grep",
  "help",
  "log",
  "ls-files",
  "ls-tree",
  "merge-base",
  "name-rev",
  "rev-list",
  "rev-parse",
  "shortlog",
  "show",
  "show-ref",
  "status",
  "version"
]);
const GIT_LISTINGS = new Map([
  ["branch", /^((-a|-r|-v|-vv|--all|--remotes|--list|--show-current)( |$))*$/],
  ["config", /(^| )(--get|--get-all|--list|-l)( |$)/],
  ["remote", /^(-v|get-url .*|show .*)?$/],
  ["stash", /^(list|show)( |$)/],
  ["tag", /^((-l|--list)( .*)?)?$/],
  ["worktree", /^list( |$)/]
]);
const HOME_RE = /^~(?=\/|$)/;
const ASSIGNMENT_RE = /^(\w+)=(.*)$/s;
const VARIABLE_RE = /\$\{?(\w+)\}?/g;
const OPTION_VALUE_RE = /^[\w-]+=/;
const UNRESOLVED_RE = /[$`]/;

function resolveArg(dir: string, token: string): string | null {
  const value = token.replace(OPTION_VALUE_RE, "").replace(HOME_RE, os.homedir());
  if (value === "" || value.startsWith("-") || UNRESOLVED_RE.test(value)) return null;
  return path.resolve(dir, value);
}

function gitTargets(dir: string, args: string[]): Target[] {
  let gitDir = dir;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "-C") {
      index++;
      gitDir = resolveArg(gitDir, args.slice(index, index + 1).join("")) ?? gitDir;
    } else if (arg === "-c") {
      index++;
    } else if (!arg.startsWith("-")) {
      const reads = GIT_READERS.has(arg) || GIT_LISTINGS.get(arg)?.test(args.slice(index + 1).join(" "));
      return reads ? [] : [{ path: gitDir, certain: false }];
    }
  }
  return [];
}

function expand(variables: Variables, token: string): string {
  return token.replace(VARIABLE_RE, (match, name: string) => variables.get(name) ?? match);
}

function commandOf(words: string[], variables: Variables): string[] {
  let start = 0;
  for (; start < words.length; start++) {
    const assignment = ASSIGNMENT_RE.exec(words[start]);
    if (assignment) variables.set(assignment[1], assignment[2]);
    else if (!PREFIXES.has(words[start])) break;
  }
  return words.slice(start);
}

export function commandTargets(source: string, cwd: string): Target[] {
  return collectTargets(source, cwd, new Map([["HOME", os.homedir()]]));
}

function collectTargets(source: string, cwd: string, variables: Variables): Target[] {
  const targets: Target[] = [];
  let dir = cwd;

  for (const command of parseCommands(source)) {
    for (const file of command.writes) {
      const target = resolveArg(dir, expand(variables, file));
      if (target !== null) targets.push({ path: target, certain: true });
    }
    const words = command.words.map((word) => expand(variables, word));
    const [first, ...args] = commandOf(words, variables);
    if (first === undefined) continue;
    const name = path.basename(first);
    const paths = args.flatMap((arg) => resolveArg(dir, arg) ?? []);

    if (name === "cd" || name === "pushd") {
      dir = paths.at(0) ?? dir;
    } else if (name === "git") {
      targets.push(...gitTargets(dir, args));
    } else if (SHELLS.has(name) && args.includes("-c")) {
      const script = args.indexOf("-c") + 1;
      targets.push(...collectTargets(args.slice(script, script + 1).join(""), dir, variables));
    } else if (WRITERS.has(name)) {
      targets.push(...paths.map((target) => ({ path: target, certain: true })));
    } else if (LAST_ARG_WRITERS.has(name)) {
      targets.push(...paths.slice(-1).map((target) => ({ path: target, certain: true })));
    } else if (!READERS.has(name) || args.some((arg) => UNSAFE_FLAGS.get(name)?.test(arg))) {
      targets.push(...[...paths, dir].map((target) => ({ path: target, certain: false })));
    }
  }
  return targets;
}
