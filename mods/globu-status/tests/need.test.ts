import { describe, expect, test } from "claude-code/testing";

import {
  dateOf,
  empty,
  isCommitCommand,
  isHidden,
  isKnowledgeLogCommand,
  isTemporaryPath,
  isUpdateSkill,
  isWritingCommand,
  levelOf,
  saved,
  statusOf,
  summaryOf
} from "../hooks/need";

describe("levels", () => {
  test("nothing done is none", async () => {
    expect(levelOf(empty())).toBe("none");
    expect(summaryOf(empty())).toBe("○ Nothing to update yet");
    expect(summaryOf(saved(1))).toBe("✓ Knowledge up to date");
    expect(statusOf(empty())).toBe("○ nothing to update");
    expect(statusOf(saved(1))).toBe("✓ up to date");
    expect(statusOf({ ...empty(), isUpdating: true })).toBe("updating...");
    expect(statusOf({ ...empty(), files: ["a"] })).toBe("◔ low");
    expect(statusOf({ ...empty(), files: ["a"], commits: 2 })).toBe("● strong");
  });

  test("a few edits are low, more are medium, a lot is strong", async () => {
    expect(levelOf({ ...empty(), files: ["a"] })).toBe("low");
    expect(levelOf({ ...empty(), files: ["a", "b"], turns: 1 })).toBe("low");
    expect(levelOf({ ...empty(), files: ["a", "b", "c"], turns: 1 })).toBe("medium");
    expect(levelOf({ ...empty(), files: ["a", "b", "c"], turns: 3, shellWrites: 3 })).toBe("strong");
  });

  test("a commit is at least medium", async () => {
    expect(levelOf({ ...empty(), files: ["a"], commits: 1 })).toBe("medium");
    expect(levelOf({ ...empty(), files: ["a", "b", "c"], commits: 2 })).toBe("strong");
    expect(summaryOf({ ...empty(), files: ["a"], commits: 1, turns: 1 })).toBe(
      "◑ Medium need to update knowledge (1 edit, 1 commit, 1 turn)"
    );
  });
});

describe("classifiers", () => {
  test("commands", async () => {
    expect(isCommitCommand('git add -A && git commit -m "x"')).toBe(true);
    expect(isCommitCommand("git log --oneline")).toBe(false);
    expect(isCommitCommand("git status | grep commit")).toBe(false);
    expect(
      isKnowledgeLogCommand('node packages/knowledge-base-cli/dist/knowledge-base.mjs log docs 2026-10-08 "x"')
    ).toBe(true);
    expect(isKnowledgeLogCommand("node x/knowledge-base.mjs validate docs")).toBe(true);
    expect(isKnowledgeLogCommand("node x/knowledge-base.mjs bases --json")).toBe(false);
    expect(isKnowledgeLogCommand('node x/globu.mjs base log docs 2026-10-08 "x"')).toBe(true);
    expect(isKnowledgeLogCommand("globu base validate docs")).toBe(true);
    expect(isKnowledgeLogCommand("node x/globu.mjs base list --json")).toBe(false);
    expect(isWritingCommand("sed -i '' 's/a/b/' src/x.ts")).toBe(true);
    expect(isWritingCommand("cat > src/x.ts <<'EOF'\nhi\nEOF")).toBe(true);
    expect(isWritingCommand("echo hi > out.txt")).toBe(true);
    expect(isWritingCommand("npm test 2>&1 | tail")).toBe(false);
    expect(isWritingCommand("cmd > /dev/null")).toBe(false);
    expect(isWritingCommand("echo hi > /tmp/x")).toBe(false);
    expect(isWritingCommand('grep -n "a>b" src')).toBe(true);
    expect(isWritingCommand("ls -la")).toBe(false);
  });

  test("skills and paths", async () => {
    expect(isUpdateSkill("globu:save-knowledge")).toBe(true);
    expect(isUpdateSkill("knowledge-base:update-knowledge")).toBe(true);
    expect(isUpdateSkill("/update-knowledge")).toBe(true);
    expect(isUpdateSkill("knowledge-base:setup")).toBe(false);
    expect(isTemporaryPath("/private/tmp/x/scratch.ts")).toBe(true);
    expect(isTemporaryPath("/Users/me/repo/node_modules/x.js")).toBe(true);
    expect(isTemporaryPath("/Users/me/repo/src/x.ts")).toBe(false);
    expect(isHidden(null, 5)).toBe(false);
    expect(isHidden(10, 5)).toBe(true);
    expect(isHidden(10, 10)).toBe(false);
    expect(dateOf(0)).toBe("1970-01-01");
  });
});
