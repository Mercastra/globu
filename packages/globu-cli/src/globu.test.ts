import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { claudeSettingsPath, manifestPath, statePath } from "../../globu-core/src/index.js";
import { baseIndex, captureIo, initRepo, read, tempDir, write } from "../../testing/index.js";
import { globuMain } from "./globu.js";

let sandbox: string;

function run(argv: string[], input: unknown = "", cwd = sandbox) {
  const io = captureIo(cwd, input);
  return { code: globuMain(argv, io), out: io.stdout, err: io.stderr };
}

function json(argv: string[]) {
  return JSON.parse(run([...argv, "--json"]).out);
}

function localRepo(name: string, files: Record<string, string> = { "README.md": `${name}\n` }): string {
  return initRepo(path.join(sandbox, "work", name), files);
}

function remoteRepo(name: string): string {
  return `file://${initRepo(path.join(sandbox, "remotes", name), { "README.md": `${name}\n` })}`;
}

beforeEach(() => {
  sandbox = tempDir();
});

describe("globu help", () => {
  it("describes the commands and where the config lives", () => {
    const help = run(["--help"]);
    expect(help.code).toBe(0);
    expect(help.out).toMatch(
      /^Usage: globu \[options\] \[command\]\n\nRegistry of knowledge shards for Claude Code\.\n/
    );
    expect(help.out).toContain("register [options] <locator>");
    expect(help.out).toContain("Config lives in ~/.globu (override with GLOBU_HOME).");
    expect(run(["--version"]).out).toMatch(/^\d+\.\d+\.\d+\n$/);
    expect(run(["help", "context"]).out).toContain("set [options] <name> <patterns...>");
  });
});

describe("globu register, show and list", () => {
  it("registers a local repo and prints what it found", () => {
    const repo = localRepo("notes", { "docs/index.md": baseIndex("notes", "Team notes") });
    const result = run(["register", "work/notes", "--use-when", "Team questions"]);
    expect(result).toEqual({
      code: 0,
      err: "",
      out: [
        "registered notes",
        "id:          notes",
        "repo:        (local only)",
        "format:      okf",
        "mode:        write",
        `path:        ${repo}`,
        "owner:       user",
        "description: Team notes",
        "use when:    Team questions",
        "roots:",
        "  docs (entry: docs/index.md)",
        "note: this repo has no origin remote, so other machines cannot sync it",
        ""
      ].join("\n")
    });
    expect(run(["list"]).out).toBe(`notes\tokf\twrite\t${repo}\n`);
    expect(json(["show", "notes"]).path).toBe(repo);
  });

  it("registers a URL and hints at missing routing text", () => {
    const url = remoteRepo("handbook");
    const result = run(["register", url, "--id", "hb"]);
    expect(result.out).toContain("registered hb\n");
    expect(result.out).toContain(`repo:        ${url}\n`);
    expect(result.out).toContain("description: -\nuse when:    -\n");
    expect(result.out).toContain("note: add routing text with `globu set hb --description ... --use-when ...`\n");
    expect(result.out).not.toContain("no origin remote");

    const editable = json(["register", url, "--path", "work/hb", "--mode", "read", "--description", "x"]);
    expect(editable).toMatchObject({ action: "attached", shard: { owner: "user", mode: "read" } });
  });

  it("shows shards in every local state", () => {
    const repo = localRepo("a", { "notes.txt": "no readme" });
    run(["register", repo, "--description", "d", "--use-when", "u"]);
    run(["set", "a", "--access", "read"]);
    expect(run(["show", "a"]).out).toContain("mode:        read (capped by manifest)\n");
    expect(run(["show", "a"]).out).toContain("roots:\n  .\n");

    fs.rmSync(repo, { recursive: true });
    expect(run(["list"]).out).toBe(`a\tgeneric\tread\t${repo} (missing)\n`);
    fs.rmSync(statePath());
    expect(run(["show", "a"]).out).toContain("path:        (not synced)\nowner:       -\n");
  });

  it("rejects bad arguments", () => {
    expect(run(["register"]).err).toBe("error: missing required argument 'locator'\n");
    expect(run(["register", ".", "--mode", "admin"]).err).toBe(
      "error: option '--mode <mode>' argument 'admin' is invalid. Allowed choices are read, write.\n"
    );
    expect(run(["show"]).err).toBe("error: missing required argument 'id'\n");
    expect(run(["show", "nope"]).err).toBe('globu: no shard registered with id "nope"\n');
    expect(run(["list"]).out).toBe("no shards registered\n");
  });
});

describe("globu set, reprobe, unregister and sync", () => {
  it("updates, reprobes and removes a shard", () => {
    const repo = localRepo("svc");
    run(["register", repo]);
    expect(
      run(["set", "svc", "--description", "Service", "--use-when", "Service work", "--mode", "read"]).out
    ).toContain("mode:        read\n");
    expect(run(["set", "svc", "--access", "nope"]).code).toBe(1);

    expect(run(["reprobe", "svc"]).out.startsWith("unchanged\n")).toBe(true);
    write(repo, "docs/index.md", baseIndex("svc"));
    expect(run(["reprobe", "svc"]).out.startsWith("updated\n")).toBe(true);
    expect(run(["sync"])).toMatchObject({ code: 0, out: "fetched\tsvc\n" });

    expect(run(["unregister", "svc", "--purge"]).out).toBe("unregistered svc, clone left in place\n");
    expect(run(["unregister"]).err).toBe("error: missing required argument 'id'\n");
    expect(run(["sync"]).out).toBe("no shards registered\n");
  });

  it("reports unregister outcomes and sync errors", () => {
    const url = remoteRepo("handbook");
    run(["register", url]);
    fs.rmSync(statePath());
    expect(run(["unregister", "handbook"]).out).toBe("unregistered handbook\n");

    run(["register", url]);
    fs.rmSync(url.slice("file://".length), { recursive: true });
    const failed = run(["sync"]);
    expect(failed.code).toBe(1);
    expect(failed.out).toMatch(/^error\thandbook\tgit pull --ff-only failed/);
    expect(run(["unregister", "handbook", "--purge"]).out).toBe("unregistered handbook, clone removed\n");
  });
});

describe("globu contexts", () => {
  it("defines, selects and removes contexts", () => {
    run(["register", localRepo("team-api")]);
    run(["register", localRepo("private")]);
    expect(run(["context", "list"]).out).toBe("no contexts defined, every shard is active\n");

    expect(run(["context", "set", "work", "team-*"]).out).toBe("context work: team-*\n");
    run(["context", "set", "personal", "private"]);
    expect(run(["use", "work"]).out).toBe("active context: work\n");
    expect(run(["context", "list"]).out).toBe("* work\tteam-*\n  personal\tprivate\n");
    expect(run(["list"]).out).toMatch(/^context: work\nteam-api\t/);
    expect(json(["list", "--all"])).toMatchObject({ context: null, shards: [{ id: "team-api" }, { id: "private" }] });

    expect(run(["use", "--all"]).out).toBe("active context: all shards\n");
    expect(run(["context", "rm", "personal"]).out).toBe("removed context personal\n");
    expect(json(["context", "list"])).toEqual({ current: null, contexts: { work: ["team-*"] } });
  });

  it("rejects bad arguments", () => {
    expect(run(["use"]).err).toBe("globu: use needs a context name, or --all\n");
    expect(run(["context", "set"]).code).toBe(1);
    expect(run(["context", "set", "work"]).err).toBe("error: missing required argument 'patterns'\n");
    expect(run(["context", "nope", "x"]).err).toBe("error: unknown command 'nope'\n");
    expect(run(["context"])).toMatchObject({ code: 1, err: expect.stringMatching(/^Usage: globu context /) });
  });
});

describe("globu index, doctor and claude sync", () => {
  it("prints the index and the diagnostics", () => {
    expect(run(["index"]).out).toBe("\n");
    expect(run(["doctor"])).toEqual({ code: 0, out: "no problems found\n", err: "" });

    const repo = localRepo("notes");
    run(["register", repo, "--description", "d", "--use-when", "u"]);
    expect(run(["index"], "", repo).out).toContain("- **notes** (generic, writable, you are working inside it)");
    expect(json(["index"]).context).toBeNull();
    expect(run(["doctor"])).toMatchObject({ code: 0, out: expect.stringContaining("warning\tnotes\tno repo URL") });

    fs.rmSync(repo, { recursive: true });
    expect(run(["doctor"])).toMatchObject({ code: 1, out: expect.stringContaining("error\tnotes\tclone is missing") });
  });

  it("syncs shard paths into the Claude settings", () => {
    const repo = localRepo("notes");
    run(["register", repo]);
    expect(run(["claude", "sync"]).out).toBe(`updated ${claudeSettingsPath()}\n${repo}\n`);
    expect(run(["claude", "sync"]).out).toBe(`unchanged ${claudeSettingsPath()}\n${repo}\n`);
    expect(run(["claude", "sync", "--remove"]).out).toBe(`updated ${claudeSettingsPath()}\n`);
    expect(JSON.parse(read(claudeSettingsPath()))).toEqual({ permissions: { additionalDirectories: [] } });
    expect(run(["claude"])).toMatchObject({ code: 1, err: expect.stringMatching(/^Usage: globu claude /) });
  });
});

describe("globu hook session-start", () => {
  it("prints nothing without shards and the index with them", () => {
    expect(run(["hook", "session-start"], { cwd: sandbox })).toEqual({ code: 0, out: "", err: "" });
    const repo = localRepo("notes");
    run(["register", repo, "--mode", "read"]);
    expect(run(["hook", "session-start"], { cwd: repo }).out).toContain(
      "- **notes** (generic, read-only, you are working inside it)"
    );
    expect(run(["hook", "session-start"], "").out).toContain("- **notes** (generic, read-only)");
  });

  it("explains a broken manifest instead of failing", () => {
    write(path.dirname(manifestPath()), "manifest.yaml", "shards: [unclosed\n");
    const result = run(["hook", "session-start"], {});
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/^Globu could not load its shard index: .*not valid YAML/);
  });
});

describe("globu hook guard", () => {
  it("blocks edits inside read-only shards only", () => {
    const repo = localRepo("notes");
    run(["register", repo, "--mode", "read"]);
    const blocked = run(["hook", "guard"], { cwd: repo, tool_input: { file_path: "docs/new.md" } });
    expect(blocked.code).toBe(2);
    expect(blocked.err).toContain(`${path.join(repo, "docs/new.md")} belongs to shard "notes", which is read-only`);
    expect(run(["hook", "guard"], { tool_input: { notebook_path: path.join(repo, "a.ipynb") } }).code).toBe(2);

    expect(run(["hook", "guard"], { tool_input: { file_path: path.join(sandbox, "elsewhere.md") } }).code).toBe(0);
    run(["set", "notes", "--mode", "write"]);
    expect(run(["hook", "guard"], { tool_input: { file_path: path.join(repo, "a.md") } }).code).toBe(0);
  });

  it("stays out of the way when it has nothing to check", () => {
    expect(run(["hook", "guard"], { tool_input: {} }).code).toBe(0);
    expect(run(["hook", "guard"], "").code).toBe(0);
    run(["register", remoteRepo("handbook")]);
    fs.rmSync(statePath());
    expect(run(["hook", "guard"], { tool_input: { file_path: "/tmp/a.md" } }).code).toBe(0);
    write(path.dirname(manifestPath()), "manifest.yaml", "shards: [unclosed\n");
    expect(run(["hook", "guard"], { tool_input: { file_path: "/tmp/a.md" } }).code).toBe(0);
  });

  it("rejects unknown hooks", () => {
    expect(run(["hook", "other"])).toEqual({ code: 1, out: "", err: "error: unknown command 'other'\n" });
    expect(run(["hook"])).toMatchObject({ code: 1, err: expect.stringMatching(/^Usage: globu hook /) });
  });
});
