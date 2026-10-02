import os from "node:os";
import path from "node:path";

export function globuHome(): string {
  return process.env.GLOBU_HOME ? path.resolve(process.env.GLOBU_HOME) : path.join(os.homedir(), ".globu");
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
