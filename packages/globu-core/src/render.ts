import path from "node:path";
import { isInside } from "../../knowledge-base/src/index.js";
import type { Root } from "./manifest.js";
import { conventionsFor } from "./probe.js";
import type { ResolvedShard } from "./registry.js";

const MAX_ROOTS = 6;

type PresentShard = ResolvedShard & { path: string };

function rootLine(shard: PresentShard, root: Root): string {
  const target = path.join(shard.path, root.entry ?? root.path);
  return root.name ? `${root.name}: ${target}` : target;
}

function shardBlock(shard: PresentShard, cwd: string): string {
  const here = isInside(shard.path, cwd) ? ", you are working inside it" : "";
  const access = shard.mode === "write" ? "writable" : "read-only";
  const lines = [`- **${shard.id}** (${shard.format}, ${access}${here})`, `  - Location: ${shard.path}`];
  if (shard.description) lines.push(`  - What: ${shard.description}`);
  if (shard.useWhen) lines.push(`  - Use when: ${shard.useWhen}`);
  if (shard.roots.length === 1) {
    lines.push(`  - Entry: ${rootLine(shard, shard.roots[0])}`);
  } else {
    lines.push("  - Entries:");
    for (const root of shard.roots.slice(0, MAX_ROOTS)) lines.push(`    - ${rootLine(shard, root)}`);
    if (shard.roots.length > MAX_ROOTS) {
      lines.push(`    - ${shard.roots.length - MAX_ROOTS} more, run \`globu show ${shard.id}\` to list them`);
    }
  }
  return lines.join("\n");
}

export function renderIndex(shards: ResolvedShard[], context: string | null, cwd: string): string {
  if (shards.length === 0) return "";
  const present = shards.filter((shard): shard is PresentShard => shard.present);
  const missing = shards.filter((shard) => !shard.present);

  const lines = [
    `# Globu knowledge shards${context === null ? "" : ` (context: ${context})`}`,
    "",
    "These knowledge sources are registered on this machine. Most live outside the current repo. When a task touches a shard's area, read its entry file first and follow links from there. Leave them alone when the task is unrelated.",
    "",
    ...present.map((shard) => shardBlock(shard, cwd))
  ];

  const conventions = [...new Set(present.map((shard) => shard.format))].flatMap((format) => {
    const text = conventionsFor(format);
    return text === null ? [] : [`- **${format}**: ${text}`];
  });
  if (conventions.length > 0) lines.push("", "## Formats", ...conventions);

  lines.push(
    "",
    "## Writing",
    "Only edit shards marked writable. Never copy knowledge from one shard into another unless the user names the target shard. To record what a session learned, use the `globu:save-knowledge` skill."
  );
  if (missing.length > 0) {
    lines.push("", `Not available locally (run \`globu sync\`): ${missing.map((shard) => shard.id).join(", ")}`);
  }
  return lines.join("\n");
}
