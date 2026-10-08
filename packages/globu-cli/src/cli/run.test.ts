import { describe, expect, it } from "vitest";
import { captureIo } from "../../../testing/index.js";
import { command, type JsonOption, print, readHookInput, runCli } from "./run.js";

const PROGRAM = { name: "tool", description: "A tool for tests.", version: "1.2.3" };

function run(...argv: string[]) {
  const io = captureIo("/");
  const code = runCli(
    PROGRAM,
    (program, exit) => {
      command(program, "ok <name>", "succeed").action((name: string, options: JsonOption) => {
        print(io, options.json, { name }, `hello ${name}`);
      });
      command(program, "code", "exit with a code").action(() => exit(3));
      command(program, "boom", "throw").action(() => {
        throw new Error("exploded");
      });
      const nested = program.command("nested").description("a group");
      command(nested, "inner", "a nested command").action(() => io.out("inner"));
    },
    argv,
    io
  );
  return { code, out: io.stdout, err: io.stderr };
}

describe("runCli", () => {
  it("prints help and the version without failing", () => {
    for (const argv of [["help"], ["--help"], ["-h"]]) {
      const result = run(...argv);
      expect(result.code).toBe(0);
      expect(result.out).toMatch(/^Usage: tool \[options\] \[command\]\n\nA tool for tests\.\n/);
      expect(result.out.endsWith("\n\n")).toBe(false);
      expect(result.err).toBe("");
    }
    expect(run("--version")).toEqual({ code: 0, out: "1.2.3\n", err: "" });
    expect(run("help", "ok").out).toMatch(/^Usage: tool ok \[options\] <name>\n/);
  });

  it("fails with the help text when no command is given", () => {
    const result = run();
    expect(result.code).toBe(1);
    expect(result.out).toBe("");
    expect(result.err).toMatch(/^Usage: tool /);
  });

  it("runs a command and returns its exit code", () => {
    expect(run("ok", "you")).toEqual({ code: 0, out: "hello you\n", err: "" });
    expect(run("ok", "you", "--json")).toEqual({ code: 0, out: '{\n  "name": "you"\n}\n', err: "" });
    expect(run("code").code).toBe(3);
    expect(run("nested", "inner")).toEqual({ code: 0, out: "inner\n", err: "" });
  });

  it("reports usage errors and thrown errors", () => {
    expect(run("toString")).toEqual({ code: 1, out: "", err: "error: unknown command 'toString'\n" });
    expect(run("nested", "nope")).toEqual({ code: 1, out: "", err: "error: unknown command 'nope'\n" });
    expect(run("nested").err).toMatch(/^Usage: tool nested /);
    expect(run("ok")).toEqual({ code: 1, out: "", err: "error: missing required argument 'name'\n" });
    expect(run("ok", "you", "--nope")).toEqual({ code: 1, out: "", err: "error: unknown option '--nope'\n" });
    expect(run("boom")).toEqual({ code: 1, out: "", err: "tool: exploded\n" });
  });
});

describe("readHookInput", () => {
  it("parses hook JSON and defaults the tool input", () => {
    expect(readHookInput(captureIo("/", { cwd: "/x", tool_input: { file_path: "a.md" } }))).toEqual({
      cwd: "/x",
      tool_input: { file_path: "a.md" }
    });
    expect(readHookInput(captureIo("/", { source: "startup" }))).toEqual({ tool_input: {} });
  });

  it("returns null for anything that is not hook JSON", () => {
    expect(readHookInput(captureIo("/", ""))).toBeNull();
    expect(readHookInput(captureIo("/", { tool_input: "nope" }))).toBeNull();
  });
});
