import path from "node:path";
import { describe, expect, it } from "vitest";
import { read, tempDir, write } from "../../testing/index.js";
import { appendLog, appendLogEntry, DEFAULT_LOG_BODY } from "./log.js";

describe("appendLogEntry", () => {
  it("keeps sections newest first and groups entries by date", () => {
    let body = appendLogEntry(DEFAULT_LOG_BODY, "2026-01-01", ["first"]);
    expect(body).toBe("# Knowledge base update log\n\n## 2026-01-01\n* first\n");
    body = appendLogEntry(body, "2026-01-02", ["second", "third"]);
    body = appendLogEntry(body, "2026-01-02", ["fourth"]);
    expect(body).toBe(
      "# Knowledge base update log\n\n## 2026-01-02\n* fourth\n* second\n* third\n\n## 2026-01-01\n* first\n"
    );
  });
});

describe("appendLog", () => {
  it("creates the log when it is missing and appends when it exists", () => {
    const docsDir = tempDir();
    const logPath = appendLog(docsDir, "2026-01-01", ["one"]);
    expect(logPath).toBe(path.join(docsDir, "log.md"));
    appendLog(docsDir, "2026-01-01", ["two"]);
    expect(read(logPath)).toBe("# Knowledge base update log\n\n## 2026-01-01\n* two\n* one\n");
  });

  it("rejects a malformed date and an empty entry list", () => {
    const docsDir = tempDir();
    write(docsDir, "log.md", DEFAULT_LOG_BODY);
    expect(() => appendLog(docsDir, "01-01-2026", ["x"])).toThrow(/YYYY-MM-DD/);
    expect(() => appendLog(docsDir, "2026-01-01", [])).toThrow(/at least one/);
  });
});
