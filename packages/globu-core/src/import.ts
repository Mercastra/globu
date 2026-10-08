import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { clone } from "./git.js";
import { looksLikeRepoUrl, sameRepo } from "./giturl.js";
import {
  loadManifest,
  type Manifest,
  type ManifestImport,
  readManifestFile,
  type Shard,
  saveManifest
} from "./manifest.js";
import { manifestPath } from "./paths.js";
import { loadState, saveState } from "./state.js";

export const DEFAULT_IMPORT_FILE = ".globu/manifest.yaml";

export type ImportOptions = { locator?: string; file?: string; context?: string; apply: boolean; cwd: string };
export type ImportPlan = {
  source: string;
  file: string | null;
  added: string[];
  updated: string[];
  contexts: string[];
};
export type ImportResult = { applied: boolean; manifestPath: string; context: string | null; plans: ImportPlan[] };

function fetchTeamManifest(entry: ManifestImport): Manifest {
  const file = entry.file ?? DEFAULT_IMPORT_FILE;
  if (!looksLikeRepoUrl(entry.source)) {
    const target = fs.statSync(entry.source, { throwIfNoEntry: false })?.isDirectory()
      ? path.join(entry.source, file)
      : entry.source;
    if (!fs.existsSync(target)) throw new Error(`no manifest at ${target}`);
    return readManifestFile(target);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "globu-import-"));
  try {
    clone(entry.source, tmp, true);
    const target = path.join(tmp, file);
    if (!fs.existsSync(target)) throw new Error(`no manifest at ${file} in ${entry.source}`);
    return readManifestFile(target);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function shardKey(shard: Shard): string {
  return JSON.stringify([
    shard.source.repo,
    shard.format,
    shard.roots,
    shard.description,
    shard.useWhen,
    shard.access ?? null
  ]);
}

function merge(manifest: Manifest, team: Manifest, entry: ManifestImport): ImportPlan {
  const plan: ImportPlan = { source: entry.source, file: entry.file ?? null, added: [], updated: [], contexts: [] };
  for (const shard of team.shards) {
    if (shard.source.repo === null) {
      throw new Error(`shard "${shard.id}" in ${entry.source} has no repo URL, so it cannot be imported`);
    }
    const known = manifest.shards.find((candidate) => candidate.id === shard.id);
    if (known === undefined) {
      const byRepo = manifest.shards.find((candidate) => sameRepo(candidate.source.repo, shard.source.repo));
      if (byRepo) throw new Error(`${shard.source.repo} is already registered as "${byRepo.id}", unregister it first`);
      manifest.shards.push({ ...shard });
      plan.added.push(shard.id);
    } else if (!sameRepo(known.source.repo, shard.source.repo)) {
      throw new Error(`id "${shard.id}" is taken by ${known.source.repo ?? "a local repo"}, unregister it first`);
    } else if (shardKey(known) !== shardKey(shard)) {
      Object.assign(known, shard);
      if (shard.access === undefined) delete known.access;
      plan.updated.push(shard.id);
    }
  }
  for (const [name, patterns] of Object.entries(team.contexts)) {
    manifest.contexts[name] = patterns;
    plan.contexts.push(name);
  }
  return plan;
}

function recordImport(manifest: Manifest, entry: ManifestImport): void {
  const index = manifest.imports.findIndex((known) => known.source === entry.source);
  if (index === -1) manifest.imports.push(entry);
  else manifest.imports[index] = entry;
}

export function importManifests(options: ImportOptions): ImportResult {
  const manifest = loadManifest();
  const state = loadState();
  let entries: ManifestImport[];
  if (options.locator === undefined) {
    if (options.file !== undefined) throw new Error("--file needs a path or a repo URL to read it from");
    if (manifest.imports.length === 0) throw new Error("nothing to import: give a path or a repo URL");
    entries = manifest.imports;
  } else {
    const source = looksLikeRepoUrl(options.locator) ? options.locator : path.resolve(options.cwd, options.locator);
    entries = [options.file === undefined ? { source } : { source, file: options.file }];
  }

  const plans = entries.map((entry) => {
    const plan = merge(manifest, fetchTeamManifest(entry), entry);
    recordImport(manifest, entry);
    return plan;
  });
  const context = options.context ?? null;
  if (context !== null && !Object.hasOwn(manifest.contexts, context)) {
    throw new Error(`unknown context "${context}" (known: ${Object.keys(manifest.contexts).join(", ") || "none"})`);
  }

  if (options.apply) {
    saveManifest(manifest);
    if (context !== null) {
      state.current = context;
      saveState(state);
    }
  }
  return { applied: options.apply, manifestPath: manifestPath(), context, plans };
}
