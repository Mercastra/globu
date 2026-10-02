import type { Manifest } from "./manifest.js";
import type { State } from "./state.js";

function matches(pattern: string, id: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(id);
}

export function activeContextName(state: State): string | null {
  return process.env.GLOBU_CONTEXT || state.current;
}

export function selectShards<T extends { id: string }>(
  shards: T[],
  manifest: Manifest,
  contextName: string | null
): T[] {
  if (contextName === null) return shards;
  if (!Object.hasOwn(manifest.contexts, contextName)) throw new Error(`unknown context: ${contextName}`);
  const patterns = manifest.contexts[contextName];
  return shards.filter((shard) => patterns.some((pattern) => matches(pattern, shard.id)));
}
