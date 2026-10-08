import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { gitAuthArgs } from "./auth.js";

export type Checkout = { root: string; commonDir: string };

const WORKTREE_PREFIX = "worktree ";

function git(args: string[], cwd?: string): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (err) {
    throw new Error(`git ${args.join(" ")} failed: ${(err as Error).message.trim()}`);
  }
}

export function isRepo(dir: string): boolean {
  try {
    return git(["rev-parse", "--is-inside-work-tree"], dir) === "true";
  } catch {
    return false;
  }
}

export function checkoutOf(dir: string): Checkout | null {
  try {
    const [root, commonDir] = git(
      ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"],
      dir
    ).split("\n");
    return { root, commonDir: fs.realpathSync(commonDir) };
  } catch {
    return null;
  }
}

export function mainCheckout(dir: string): string {
  const [main, kind] = git(["worktree", "list", "--porcelain"], dir).split("\n");
  if (kind === "bare") return git(["rev-parse", "--show-toplevel"], dir);
  return fs.realpathSync(main.slice(WORKTREE_PREFIX.length));
}

export function worktreeRoots(dir: string): string[] {
  return git(["worktree", "list", "--porcelain"], dir)
    .split("\n")
    .filter((line) => line.startsWith(WORKTREE_PREFIX))
    .map((line) => line.slice(WORKTREE_PREFIX.length));
}

export function defaultRevision(dir: string): string {
  try {
    return git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], dir);
  } catch {
    return "HEAD";
  }
}

export function hasPath(dir: string, revision: string, relPath: string): boolean {
  try {
    git(["cat-file", "-e", `${revision}:${relPath}`], dir);
    return true;
  } catch {
    return false;
  }
}

export function originUrl(dir: string): string | null {
  try {
    return git(["remote", "get-url", "origin"], dir);
  } catch {
    return null;
  }
}

export function clone(repoUrl: string, destDir: string, shallow: boolean): void {
  git([...gitAuthArgs(repoUrl), "clone", ...(shallow ? ["--depth", "1"] : []), repoUrl, destDir]);
}

export function pull(dir: string, repoUrl: string | null): void {
  git([...gitAuthArgs(repoUrl), "pull", "--ff-only"], dir);
}

export function fetch(dir: string): void {
  git(["fetch", "--quiet"], dir);
}
