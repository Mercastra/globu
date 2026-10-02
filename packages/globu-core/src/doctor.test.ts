import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { baseIndex, git, initRepo, tempDir, write } from "../../testing/index.js";
import { doctor } from "./doctor.js";
import { statePath } from "./paths.js";
import { register } from "./registry.js";

function messages(): string[] {
  return doctor().map((finding) => `${finding.level} ${finding.id}: ${finding.message}`);
}

describe("doctor", () => {
  it("finds nothing wrong with a healthy shard", () => {
    const sandbox = tempDir();
    const url = `file://${initRepo(path.join(sandbox, "remote"), { "README.md": "x" })}`;
    register({ locator: url, cwd: sandbox, id: "ok", description: "d", useWhen: "u" });
    expect(doctor()).toEqual([]);
  });

  it("warns about missing routing text and a missing remote", () => {
    const repo = initRepo(path.join(tempDir(), "local"), { "README.md": "x" });
    register({ locator: repo, cwd: repo });
    expect(messages()).toEqual([
      "warning local: no repo URL, so this shard cannot be synced to another machine",
      "warning local: no description, Claude cannot tell what this shard holds",
      "warning local: no useWhen, Claude cannot tell when to consult this shard"
    ]);
  });

  it("notices format and root drift", () => {
    const repo = initRepo(path.join(tempDir(), "svc"), { "README.md": "x" });
    git(repo, "remote", "add", "origin", "https://example.com/acme/svc.git");
    register({ locator: repo, cwd: repo, description: "d", useWhen: "u" });

    write(repo, "docs/index.md", baseIndex("svc"));
    expect(messages()).toEqual([
      'warning svc: format is now "okf", the manifest says "generic", run `globu reprobe svc`'
    ]);

    register({ locator: repo, cwd: repo, id: "svc" });
    fs.rmSync(path.join(process.env.GLOBU_HOME as string, "manifest.yaml"));
    register({ locator: repo, cwd: repo, description: "d", useWhen: "u" });
    write(repo, "pkg/docs/index.md", baseIndex("pkg"));
    expect(messages()).toEqual(["warning svc: the set of roots changed since registration, run `globu reprobe svc`"]);
  });

  it("reports clone problems as errors", () => {
    const sandbox = tempDir();
    const repo = initRepo(path.join(sandbox, "svc"), { "README.md": "x" });
    git(repo, "remote", "add", "origin", "https://example.com/acme/svc.git");
    register({ locator: repo, cwd: repo, description: "d", useWhen: "u" });

    git(repo, "remote", "set-url", "origin", "https://example.com/acme/other.git");
    expect(messages()).toEqual([
      "error svc: the clone's origin does not match the manifest (https://example.com/acme/svc.git)"
    ]);

    fs.rmSync(path.join(repo, ".git"), { recursive: true });
    expect(messages()).toEqual([`error svc: ${repo} is not a git repository`]);

    fs.rmSync(repo, { recursive: true });
    expect(messages()).toEqual([`error svc: clone is missing at ${repo}`]);

    fs.rmSync(statePath());
    expect(messages()).toEqual(["error svc: not cloned on this machine, run `globu sync`"]);
  });
});
