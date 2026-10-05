import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { baseIndex, initRepo, read, tempDir, write } from "../packages/testing/index.js";

const root = path.join(import.meta.dirname, "..");
const GLOBU = path.join(root, "packages/globu-cli/dist/globu.mjs");
const KNOWLEDGE_BASE = path.join(root, "packages/knowledge-base-cli/dist/knowledge-base.mjs");
const PLUGINS = [
  { plugin: "plugins/globu", packageDir: "packages/globu-cli" },
  { plugin: "plugins/knowledge-base", packageDir: "packages/knowledge-base-cli" }
];

type HooksFile = { hooks: Record<string, { hooks: { command: string }[] }[]> };

function runBundle(bundle: string, args: string[], input: unknown = "") {
  return spawnSync(bundle, args, {
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env }
  });
}

function hookCommands(plugin: string): string[] {
  const file = JSON.parse(read(root, plugin, "hooks/hooks.json")) as HooksFile;
  return Object.values(file.hooks).flatMap((matchers) =>
    matchers.flatMap((matcher) => matcher.hooks.map((hook) => hook.command))
  );
}

describe("bundled CLIs", () => {
  it("globu runs as a standalone executable and reads hook input from stdin", () => {
    expect(runBundle(GLOBU, ["--version"]).stdout).toMatch(/^\d+\.\d+\.\d+\n$/);

    const repo = initRepo(path.join(tempDir(), "notes"), { "docs/index.md": baseIndex("notes") });
    expect(runBundle(GLOBU, ["register", repo, "--mode", "read"]).status).toBe(0);
    expect(runBundle(GLOBU, ["hook", "session-start"], { cwd: repo }).stdout).toContain("- **notes** (okf, read-only");

    const blocked = runBundle(GLOBU, ["hook", "guard"], { tool_input: { file_path: path.join(repo, "docs/x.md") } });
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toContain("read-only");

    expect(runBundle(GLOBU, ["set", "notes", "--mode", "ask"]).status).toBe(0);
    const asked = runBundle(GLOBU, ["hook", "guard"], { tool_input: { file_path: path.join(repo, "docs/x.md") } });
    expect(asked.status).toBe(0);
    expect(JSON.parse(asked.stdout).hookSpecificOutput.permissionDecision).toBe("ask");
    expect(runBundle(GLOBU, ["nope"]).status).toBe(1);
  });

  it("knowledge-base runs as a standalone executable", () => {
    const repo = tempDir();
    expect(runBundle(KNOWLEDGE_BASE, ["setup", repo, "--name", "demo"]).status).toBe(0);
    const bad = write(repo, "docs/bad.md", "bare\n");
    const hook = runBundle(KNOWLEDGE_BASE, ["hook", "validate-edit"], { tool_input: { file_path: bad } });
    expect(hook.status).toBe(2);
    expect(hook.stderr).toContain("missing YAML frontmatter block");
  });
});

describe("published packages", () => {
  it.each(PLUGINS)("$packageDir carries the root version and ships its bundle", ({ packageDir }) => {
    const manifest = JSON.parse(read(root, packageDir, "package.json"));
    expect(manifest.version).toBe(JSON.parse(read(root, "package.json")).version);
    expect(manifest.files).toEqual(["dist"]);
    expect(manifest.license).toBe("MIT");
    expect(read(root, packageDir, "LICENSE")).toBe(read(root, "LICENSE"));
    for (const bin of Object.values<string>(manifest.bin)) {
      expect(fs.existsSync(path.join(root, packageDir, bin))).toBe(true);
    }
  });
});

describe("plugin hooks", () => {
  it.each(PLUGINS)("$plugin hooks run the CLI from the installed package", ({ plugin, packageDir }) => {
    const { name, bin } = JSON.parse(read(root, packageDir, "package.json"));
    const commands = hookCommands(plugin);
    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) {
      for (const bundle of Object.values<string>(bin)) {
        expect(command).toContain(`"\${CLAUDE_PLUGIN_ROOT}/node_modules/${name}/${bundle}"`);
      }
      const result = spawnSync(command, {
        shell: true,
        input: "{}",
        encoding: "utf8",
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: path.join(root, plugin) }
      });
      expect(result.status).toBe(0);
    }
  });
});
