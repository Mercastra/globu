import { isRepo, originUrl } from "./git.js";
import { sameRepo } from "./giturl.js";
import type { Root } from "./manifest.js";
import { probeDir } from "./probe.js";
import { type ResolvedShard, resolveAll } from "./registry.js";

export type Finding = { id: string; level: "error" | "warning"; message: string };

function rootsKey(roots: Root[]): string {
  return JSON.stringify(roots.map((root) => root.path).sort());
}

function cloneFindings(shard: ResolvedShard): Omit<Finding, "id">[] {
  if (shard.path === null) return [{ level: "error", message: "not cloned on this machine, run `globu sync`" }];
  if (!shard.present) return [{ level: "error", message: `clone is missing at ${shard.path}` }];
  if (!isRepo(shard.path)) return [{ level: "error", message: `${shard.path} is not a git repository` }];

  const findings: Omit<Finding, "id">[] = [];
  if (shard.source.repo !== null && !sameRepo(originUrl(shard.path), shard.source.repo)) {
    findings.push({ level: "error", message: `the clone's origin does not match the manifest (${shard.source.repo})` });
  }
  const probed = probeDir(shard.path);
  if (probed.format !== shard.format) {
    findings.push({
      level: "warning",
      message: `format is now "${probed.format}", the manifest says "${shard.format}", run \`globu reprobe ${shard.id}\``
    });
  } else if (rootsKey(probed.roots) !== rootsKey(shard.roots)) {
    findings.push({
      level: "warning",
      message: `the set of roots changed since registration, run \`globu reprobe ${shard.id}\``
    });
  }
  return findings;
}

function routingFindings(shard: ResolvedShard): Omit<Finding, "id">[] {
  const findings: Omit<Finding, "id">[] = [];
  if (shard.source.repo === null) {
    findings.push({ level: "warning", message: "no repo URL, so this shard cannot be synced to another machine" });
  }
  if (!shard.description) {
    findings.push({ level: "warning", message: "no description, Claude cannot tell what this shard holds" });
  }
  if (!shard.useWhen) {
    findings.push({ level: "warning", message: "no useWhen, Claude cannot tell when to consult this shard" });
  }
  return findings;
}

export function doctor(): Finding[] {
  return resolveAll().shards.flatMap((shard) =>
    [...routingFindings(shard), ...cloneFindings(shard)].map((finding) => ({ id: shard.id, ...finding }))
  );
}
