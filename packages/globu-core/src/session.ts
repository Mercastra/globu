import fs from "node:fs";
import path from "node:path";
import { isInside } from "../../knowledge-base/src/index.js";
import { type Checkout, checkoutOf } from "./git.js";
import type { ResolvedShard } from "./registry.js";

export type SessionShard = ResolvedShard & { here: boolean; workPath: string | null };

function commonDirOf(shardPath: string): string | null {
  const dotGit = path.join(shardPath, ".git");
  if (fs.statSync(dotGit, { throwIfNoEntry: false })?.isDirectory()) return fs.realpathSync(dotGit);
  return checkoutOf(shardPath)?.commonDir ?? null;
}

function existingDir(target: string): string {
  let dir = fs.statSync(target, { throwIfNoEntry: false })?.isDirectory() ? target : path.dirname(target);
  while (!fs.existsSync(dir)) dir = path.dirname(dir);
  return dir;
}

export function sessionHome(cwd: string): string {
  return process.env.CLAUDE_PROJECT_DIR || cwd;
}

export function locate<T extends ResolvedShard>(
  shards: T[],
  cwd: string
): (T & { here: boolean; workPath: string | null })[] {
  const session = checkoutOf(cwd);
  return shards.map((shard) => {
    const root =
      session !== null && shard.path !== null && commonDirOf(shard.path) === session.commonDir ? session.root : null;
    return { ...shard, here: root !== null, workPath: root ?? shard.path };
  });
}

export function shardFinder<T extends ResolvedShard>(shards: T[]): (target: string) => T | undefined {
  const checkouts = new Map<string, Checkout | null>();
  return (target) => {
    const dir = existingDir(target);
    let checkout = checkouts.get(dir);
    if (checkout === undefined) {
      checkout = checkoutOf(dir);
      checkouts.set(dir, checkout);
    }
    const commonDir = checkout?.commonDir;
    if (commonDir === undefined) return shards.find((shard) => shard.path !== null && isInside(shard.path, target));
    return shards.find((shard) => shard.path !== null && commonDirOf(shard.path) === commonDir);
  };
}
