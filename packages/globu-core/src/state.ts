import { z } from "zod";
import { statePath } from "./paths.js";
import { readConfig, writeConfig } from "./store.js";

const ModeSchema = z.enum(["read", "write"]);
const OwnerSchema = z.enum(["globu", "user"]);

const LocalShardSchema = z.object({
  path: z.string(),
  mode: ModeSchema,
  owner: OwnerSchema
});

const StateSchema = z.object({
  version: z.number().default(1),
  current: z.string().nullable().default(null),
  shards: z.record(z.string(), LocalShardSchema).default({}),
  claude: z.object({ directories: z.array(z.string()).default([]) }).default({ directories: [] })
});

export type Mode = z.infer<typeof ModeSchema>;
export type Owner = z.infer<typeof OwnerSchema>;
export type LocalShard = z.infer<typeof LocalShardSchema>;
export type State = z.infer<typeof StateSchema>;

export function loadState(): State {
  return readConfig(statePath(), StateSchema);
}

export function saveState(state: State): void {
  writeConfig(statePath(), state);
}
