import type { Target } from "./command.js";
import type { ResolvedShard } from "./registry.js";
import { locate, shardFinder } from "./session.js";

export type Verdict = { decision: "deny" | "ask"; shard: ResolvedShard; target: Target };

export function guardVerdict(shards: ResolvedShard[], targets: Target[], home: string): Verdict | null {
  const guarded = shards.filter((shard) => shard.mode !== "write");
  if (guarded.length === 0) return null;
  const find = shardFinder(guarded);

  let ask: Verdict | null = null;
  for (const target of targets) {
    const shard = find(target.path);
    if (!shard) continue;
    if (shard.mode === "read" && target.certain) return { decision: "deny", shard, target };
    if (ask === null && !locate([shard], home)[0].here) ask = { decision: "ask", shard, target };
  }
  return ask;
}
