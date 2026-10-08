import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function writable(dir: string): boolean {
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function globuHome(): string {
  if (process.env.GLOBU_HOME) return path.resolve(process.env.GLOBU_HOME);
  const home = path.join(os.homedir(), ".globu");
  if (fs.existsSync(home) || writable(os.homedir())) return home;
  return path.join(os.tmpdir(), "globu");
}

export function manifestPath(): string {
  return path.join(globuHome(), "manifest.yaml");
}

export function statePath(): string {
  return path.join(globuHome(), "state.yaml");
}

export function clonesDir(): string {
  return path.join(globuHome(), "clones");
}

export function claudeSettingsPath(): string {
  const dir = process.env.CLAUDE_CONFIG_DIR
    ? path.resolve(process.env.CLAUDE_CONFIG_DIR)
    : path.join(os.homedir(), ".claude");
  return path.join(dir, "settings.json");
}
