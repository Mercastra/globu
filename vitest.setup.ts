import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach } from "vitest";

for (const name of Object.keys(process.env)) {
  if (name.startsWith("GIT_")) delete process.env[name];
}

beforeEach(() => {
  const sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "globu-home-")));
  process.env.GLOBU_HOME = path.join(sandbox, "globu");
  process.env.CLAUDE_CONFIG_DIR = path.join(sandbox, "claude");
  delete process.env.GLOBU_CONTEXT;
});
