import { z } from "zod";
import { manifestPath } from "./paths.js";
import { readConfig, writeConfig } from "./store.js";

const RootSchema = z.object({
  path: z.string(),
  name: z.string().optional(),
  entry: z.string().optional()
});

const ShardSchema = z.object({
  id: z.string().min(1),
  source: z.object({ type: z.literal("git"), repo: z.string().nullable() }),
  format: z.string(),
  roots: z.array(RootSchema).min(1),
  description: z.string().default(""),
  useWhen: z.string().default(""),
  access: z.literal("read").optional()
});

const ManifestSchema = z.object({
  version: z.number().default(1),
  shards: z.array(ShardSchema).default([]),
  contexts: z.record(z.string(), z.array(z.string()).min(1)).default({})
});

export type Root = z.infer<typeof RootSchema>;
export type Shard = z.infer<typeof ShardSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

export function loadManifest(): Manifest {
  return readConfig(manifestPath(), ManifestSchema);
}

export function saveManifest(manifest: Manifest): void {
  writeConfig(manifestPath(), manifest);
}
