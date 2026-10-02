import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { claudeSettingsPath, clonesDir, globuHome, manifestPath, statePath } from "./paths.js";

describe("paths", () => {
  it("default to the home directory", () => {
    delete process.env.GLOBU_HOME;
    delete process.env.CLAUDE_CONFIG_DIR;
    expect(globuHome()).toBe(path.join(os.homedir(), ".globu"));
    expect(claudeSettingsPath()).toBe(path.join(os.homedir(), ".claude", "settings.json"));
  });

  it("follow the environment overrides", () => {
    process.env.GLOBU_HOME = "/tmp/custom-globu";
    process.env.CLAUDE_CONFIG_DIR = "/tmp/custom-claude";
    expect(manifestPath()).toBe("/tmp/custom-globu/manifest.yaml");
    expect(statePath()).toBe("/tmp/custom-globu/state.yaml");
    expect(clonesDir()).toBe("/tmp/custom-globu/clones");
    expect(claudeSettingsPath()).toBe("/tmp/custom-claude/settings.json");
  });
});
