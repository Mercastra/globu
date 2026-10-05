import { execFileSync } from "node:child_process";
import fs from "node:fs";

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

export function originUrl(dir: string): string | null {
  try {
    return git(["remote", "get-url", "origin"], dir);
  } catch {
    return null;
  }
}

export function clone(repoUrl: string, destDir: string, shallow: boolean): void {
  git(["clone", ...(shallow ? ["--depth", "1"] : []), repoUrl, destDir]);
}

export function pull(dir: string): void {
  git(["pull", "--ff-only"], dir);
}

export function fetch(dir: string): void {
  git(["fetch", "--quiet"], dir);
}
