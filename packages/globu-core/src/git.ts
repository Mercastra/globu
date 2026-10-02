import { execFileSync } from "node:child_process";

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

export function repoRoot(dir: string): string {
  return git(["rev-parse", "--show-toplevel"], dir);
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
