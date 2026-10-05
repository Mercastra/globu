import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function tempDir(): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "globu-test-")));
}

export function write(root: string, relPath: string, content: string): string {
  const target = path.join(root, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}

export function read(...segments: string[]): string {
  return fs.readFileSync(path.join(...segments), "utf8");
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.email=test@example.com", "-c", "user.name=Test", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

export function initRepo(root: string, files: Record<string, string> = {}): string {
  fs.mkdirSync(root, { recursive: true });
  git(root, "init", "-q", "-b", "main");
  for (const [relPath, content] of Object.entries(files)) write(root, relPath, content);
  git(root, "add", "-A");
  git(root, "commit", "-q", "--allow-empty", "-m", "init");
  return root;
}

export function commitAll(root: string, message = "update"): void {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
}

export function addWorktree(repo: string, dir: string, branch: string): string {
  git(repo, "worktree", "add", "-q", "-b", branch, dir);
  return fs.realpathSync(dir);
}

export function bareWorktree(repo: string, bareDir: string, dir: string): string {
  git(repo, "clone", "-q", "--bare", repo, bareDir);
  git(bareDir, "worktree", "add", "-q", "-b", "work", dir);
  return fs.realpathSync(dir);
}

export function baseIndex(name: string, description = ""): string {
  const descriptionLine = description ? `description: ${description}\n` : "";
  return `---\nokf_version: "0.2"\nname: ${name}\n${descriptionLine}---\n\n# ${name}\n`;
}

export type CapturedIo = {
  out: (text: string) => void;
  err: (text: string) => void;
  stdin: () => string;
  cwd: string;
  stdout: string;
  stderr: string;
};

export function captureIo(cwd: string, input: unknown = ""): CapturedIo {
  const io: CapturedIo = {
    cwd,
    stdout: "",
    stderr: "",
    out: (text) => {
      io.stdout += `${text}\n`;
    },
    err: (text) => {
      io.stderr += `${text}\n`;
    },
    stdin: () => (typeof input === "string" ? input : JSON.stringify(input))
  };
  return io;
}
