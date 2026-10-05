import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { addWorktree, bareWorktree, initRepo, tempDir, write } from "../../testing/index.js";
import type { ResolvedShard } from "./registry.js";
import { locate, sessionHome, shardFinder } from "./session.js";

let sandbox: string;
let repo: string;

function shard(id: string, shardPath: string | null): ResolvedShard {
  return {
    id,
    source: { type: "git", repo: null },
    format: "generic",
    roots: [{ path: "." }],
    description: "",
    useWhen: "",
    path: shardPath,
    owner: "user",
    mode: "write",
    present: shardPath !== null
  };
}

beforeEach(() => {
  sandbox = tempDir();
  repo = initRepo(path.join(sandbox, "product"), { "docs/a.md": "a\n" });
});

describe("locate", () => {
  it("points a shard at the worktree the session runs in", () => {
    const nested = addWorktree(repo, path.join(repo, ".claude/worktrees/one"), "one");
    const outside = addWorktree(repo, path.join(sandbox, "elsewhere"), "two");
    const shards = [shard("product", repo), shard("other", initRepo(path.join(sandbox, "other"))), shard("gone", null)];

    expect(locate(shards, path.join(nested, "docs")).map((located) => [located.here, located.workPath])).toEqual([
      [true, nested],
      [false, shards[1].path],
      [false, null]
    ]);
    expect(locate(shards, outside)[0]).toMatchObject({ here: true, workPath: outside });
    expect(locate(shards, path.join(repo, "docs"))[0]).toMatchObject({ here: true, workPath: repo });
    expect(locate(shards, sandbox)[0]).toMatchObject({ here: false, workPath: repo });
  });

  it("matches a shard whose path is a linked worktree or no longer a repo", () => {
    const bare = path.join(sandbox, "bare.git");
    const first = bareWorktree(repo, bare, path.join(sandbox, "first"));
    const second = addWorktree(bare, path.join(sandbox, "second"), "second");
    expect(locate([shard("tree", first)], second)[0]).toMatchObject({ here: true, workPath: second });

    const plain = path.join(sandbox, "plain");
    write(plain, "notes.md", "n\n");
    expect(locate([shard("plain", plain)], repo)[0]).toMatchObject({ here: false, workPath: plain });
  });
});

describe("shardFinder", () => {
  it("finds the shard by the repo the file belongs to", () => {
    const outside = addWorktree(repo, path.join(sandbox, "elsewhere"), "two");
    const other = initRepo(path.join(repo, "vendor/other"));
    const find = shardFinder([shard("product", repo)]);

    expect(find(path.join(outside, "new/dir/file.md"))?.id).toBe("product");
    expect(find(path.join(outside, "new/dir/other.md"))?.id).toBe("product");
    expect(find(path.join(repo, "docs/a.md"))?.id).toBe("product");
    expect(find(repo)?.id).toBe("product");
    expect(find(path.join(other, "file.md"))).toBeUndefined();
    expect(find(sandbox)).toBeUndefined();
    expect(shardFinder([shard("gone", null)])(path.join(repo, "docs/a.md"))).toBeUndefined();
  });

  it("falls back to the path when the file is not in a checkout", () => {
    fs.rmSync(path.join(repo, ".git"), { recursive: true });
    const find = shardFinder([shard("gone", null), shard("product", repo)]);
    expect(find(path.join(repo, "docs/a.md"))?.id).toBe("product");
    expect(find(path.join(sandbox, "file.md"))).toBeUndefined();
  });
});

describe("sessionHome", () => {
  it("prefers the directory the session started in", () => {
    expect(sessionHome("/now")).toBe("/now");
    process.env.CLAUDE_PROJECT_DIR = "/started";
    expect(sessionHome("/now")).toBe("/started");
  });
});
