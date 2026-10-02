import fs from "node:fs";
import path from "node:path";
import { isMapping } from "../../knowledge-base/src/index.js";
import { claudeSettingsPath } from "./paths.js";
import { resolveActive } from "./registry.js";
import { saveState } from "./state.js";

export type ClaudeSyncResult = { settingsPath: string; changed: boolean; directories: string[] };

function readSettings(settingsPath: string): Record<string, unknown> {
  if (!fs.existsSync(settingsPath)) return {};
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {}
  if (!isMapping(parsed)) throw new Error(`${settingsPath} is not a valid JSON object, leaving it untouched`);
  return parsed;
}

export function syncClaudeDirectories(remove: boolean): ClaudeSyncResult {
  const { state, shards } = resolveActive();
  const settingsPath = claudeSettingsPath();
  const settings = readSettings(settingsPath);
  const permissions = isMapping(settings.permissions) ? settings.permissions : {};
  const current: unknown[] = Array.isArray(permissions.additionalDirectories) ? permissions.additionalDirectories : [];

  const managed = new Set<unknown>(state.claude.directories);
  const desired = remove ? [] : shards.flatMap((shard) => (shard.present && shard.path !== null ? [shard.path] : []));
  const kept = current.filter((dir) => !managed.has(dir));
  const next = [...kept, ...desired.filter((dir) => !kept.includes(dir))];
  const changed = JSON.stringify(current) !== JSON.stringify(next);

  if (changed) {
    settings.permissions = { ...permissions, additionalDirectories: next };
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  }
  state.claude = { directories: desired };
  saveState(state);
  return { settingsPath, changed, directories: desired };
}
