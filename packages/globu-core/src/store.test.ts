import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadManifest, saveManifest } from "./manifest.js";
import { globuHome, manifestPath, statePath } from "./paths.js";
import { loadState, saveState } from "./state.js";

function writeRaw(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe("manifest and state files", () => {
  it("start empty when the files do not exist", () => {
    expect(loadManifest()).toEqual({ version: 1, shards: [], contexts: {}, imports: [] });
    expect(loadState()).toEqual({ version: 1, current: null, shards: {}, claude: { directories: [] } });
    expect(fs.existsSync(globuHome())).toBe(false);
  });

  it("treat an empty file as empty config", () => {
    writeRaw(manifestPath(), "");
    expect(loadManifest().shards).toEqual([]);
  });

  it("round-trip through YAML and fill in defaults", () => {
    saveManifest({
      version: 1,
      shards: [
        {
          id: "a",
          source: { type: "git", repo: null },
          format: "generic",
          roots: [{ path: "." }],
          description: "",
          useWhen: ""
        }
      ],
      contexts: { work: ["a"] },
      imports: []
    });
    saveState({
      version: 1,
      current: "work",
      shards: { a: { path: "/tmp/a", mode: "write", owner: "user" } },
      claude: { directories: [] }
    });
    expect(loadManifest().contexts).toEqual({ work: ["a"] });
    expect(loadState().shards.a.mode).toBe("write");

    writeRaw(
      manifestPath(),
      "shards:\n  - id: b\n    source: { type: git, repo: null }\n    format: okf\n    roots: [{ path: docs }]\n"
    );
    expect(loadManifest().shards[0]).toMatchObject({ id: "b", description: "", useWhen: "" });
  });

  it("reject invalid YAML and invalid shapes with the file name", () => {
    writeRaw(manifestPath(), "shards: [unclosed\n");
    expect(() => loadManifest()).toThrow(/manifest\.yaml is not valid YAML/);
    writeRaw(manifestPath(), "shards:\n  - id: a\n");
    expect(() => loadManifest()).toThrow(/manifest\.yaml is invalid/);
    writeRaw(statePath(), "shards:\n  a: { path: /tmp/a, mode: admin, owner: user }\n");
    expect(() => loadState()).toThrow(/state\.yaml is invalid/);
  });
});
