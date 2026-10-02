import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initRepo, read, tempDir, write } from "../../testing/index.js";
import { syncClaudeDirectories } from "./claude.js";
import { claudeSettingsPath } from "./paths.js";
import { register } from "./registry.js";
import { loadState } from "./state.js";

function settings(): Record<string, unknown> {
  return JSON.parse(read(claudeSettingsPath()));
}

function seedSettings(content: string): void {
  write(path.dirname(claudeSettingsPath()), "settings.json", content);
}

function registerRepo(name: string): string {
  const repo = initRepo(path.join(tempDir(), name), { "README.md": name });
  register({ locator: repo, cwd: repo });
  return repo;
}

describe("syncClaudeDirectories", () => {
  it("creates the settings file when needed", () => {
    const repo = registerRepo("a");
    expect(syncClaudeDirectories(false)).toEqual({
      settingsPath: claudeSettingsPath(),
      changed: true,
      directories: [repo]
    });
    expect(settings()).toEqual({ permissions: { additionalDirectories: [repo] } });
    expect(loadState().claude.directories).toEqual([repo]);
  });

  it("only manages the directories it added", () => {
    seedSettings(JSON.stringify({ model: "x", permissions: { allow: ["Read"], additionalDirectories: ["/mine"] } }));
    const repoA = registerRepo("a");
    const repoB = registerRepo("b");
    fs.rmSync(repoB, { recursive: true });

    expect(syncClaudeDirectories(false).changed).toBe(true);
    expect(settings()).toEqual({
      model: "x",
      permissions: { allow: ["Read"], additionalDirectories: ["/mine", repoA] }
    });
    expect(syncClaudeDirectories(false).changed).toBe(false);

    expect(syncClaudeDirectories(true)).toMatchObject({ changed: true, directories: [] });
    expect(settings().permissions).toEqual({ allow: ["Read"], additionalDirectories: ["/mine"] });
  });

  it("does not duplicate a directory the user already listed", () => {
    const repo = registerRepo("a");
    seedSettings(JSON.stringify({ permissions: { additionalDirectories: [repo] } }));
    expect(syncClaudeDirectories(false).changed).toBe(false);
  });

  it("replaces a permissions value that is not a mapping", () => {
    const repo = registerRepo("a");
    seedSettings(JSON.stringify({ permissions: "broken" }));
    syncClaudeDirectories(false);
    expect(settings()).toEqual({ permissions: { additionalDirectories: [repo] } });
  });

  it("leaves an unreadable settings file untouched", () => {
    registerRepo("a");
    seedSettings("{ not json");
    expect(() => syncClaudeDirectories(false)).toThrow(/not a valid JSON object/);
    seedSettings("[]");
    expect(() => syncClaudeDirectories(false)).toThrow(/not a valid JSON object/);
    expect(read(claudeSettingsPath())).toBe("[]");
  });
});
