import { describe, expect, it } from "vitest";
import type { ResolvedShard } from "./registry.js";
import { renderIndex } from "./render.js";

function shard(overrides: Partial<ResolvedShard>): ResolvedShard {
  return {
    id: "product",
    source: { type: "git", repo: null },
    format: "okf",
    roots: [{ path: "docs", name: "product", entry: "docs/index.md" }],
    description: "",
    useWhen: "",
    path: "/shards/product",
    owner: "user",
    mode: "write",
    present: true,
    ...overrides
  };
}

describe("renderIndex", () => {
  it("is empty when there are no shards", () => {
    expect(renderIndex([], null, "/")).toBe("");
  });

  it("lists routing text, entries and format conventions", () => {
    const text = renderIndex(
      [
        shard({ description: "Product decisions", useWhen: "Pricing questions" }),
        shard({ id: "handbook", format: "generic", mode: "read", path: "/shards/handbook", roots: [{ path: "." }] })
      ],
      "work",
      "/shards/product/docs"
    );
    expect(text).toContain("# Globu knowledge shards (context: work)");
    expect(text).toContain("- **product** (okf, writable, you are working inside it)");
    expect(text).toContain("  - What: Product decisions\n  - Use when: Pricing questions");
    expect(text).toContain("  - Entry: product: /shards/product/docs/index.md");
    expect(text).toContain(
      "- **handbook** (generic, read-only)\n  - Location: /shards/handbook\n  - Entry: /shards/handbook"
    );
    expect(text).toContain("- **okf**: Each root is an OKF base.");
    expect(text).toContain("- **generic**: This shard has no declared knowledge format.");
    expect(text).not.toContain("Not available locally");
  });

  it("truncates long root lists and skips unknown formats", () => {
    const roots = Array.from({ length: 8 }, (_, index) => ({
      path: `pkg${index}/docs`,
      entry: `pkg${index}/docs/index.md`
    }));
    const text = renderIndex([shard({ format: "mystery", roots })], null, "/elsewhere");
    expect(text).toContain("# Globu knowledge shards\n");
    expect(text).toContain("  - Entries:\n    - /shards/product/pkg0/docs/index.md");
    expect(text).toContain("    - 2 more, run `globu show product` to list them");
    expect(text).not.toContain("pkg6");
    expect(text).not.toContain("## Formats");

    const short = renderIndex([shard({ roots: roots.slice(0, 2) })], null, "/elsewhere");
    expect(short).not.toContain("more, run");
  });

  it("names shards that are not on this machine", () => {
    const text = renderIndex(
      [shard({ id: "a", present: false }), shard({ id: "b", path: null, present: false })],
      null,
      "/"
    );
    expect(text).toContain("Not available locally (run `globu sync`): a, b");
    expect(text).not.toContain("## Formats");
  });
});
