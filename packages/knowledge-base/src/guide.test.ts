import { describe, expect, it } from "vitest";
import { AUTHORING_GUIDE_END, AUTHORING_GUIDE_START, authoringGuideBlock, upsertAuthoringGuide } from "./guide.js";

describe("upsertAuthoringGuide", () => {
  const block = authoringGuideBlock();

  it("inserts the guide after the title and its intro line", () => {
    const body = upsertAuthoringGuide("\n# Title\n\nIntro line.\n\n## Contents\n");
    expect(body).toBe(`# Title\n\nIntro line.\n\n${block}\n\n## Contents\n`);
  });

  it("inserts the guide right after a title with no intro", () => {
    expect(upsertAuthoringGuide("# Title\n")).toBe(`# Title\n\n${block}\n\n`);
  });

  it("keeps a hard-wrapped intro paragraph in one piece", () => {
    const body = upsertAuthoringGuide(
      "# Title\n\nFirst line of the intro,\nwrapped onto a second line.\n\nSecond paragraph.\n"
    );
    expect(body).toBe(
      `# Title\n\nFirst line of the intro,\nwrapped onto a second line.\n\n${block}\n\nSecond paragraph.\n`
    );
  });

  it.each([
    ["a heading", "## Contents\n\n* [a](./a.md)\n"],
    ["a list", "* [a](./a.md)\n* [b](./b.md)\n"],
    ["a numbered list", "1. first\n2. second\n"],
    ["a table", "| a | b |\n|---|---|\n"],
    ["a comment", "<!-- note -->\ntext\n"]
  ])("does not take %s for the intro", (_, rest) => {
    expect(upsertAuthoringGuide(`# Title\n\n${rest}`)).toBe(`# Title\n\n${block}\n\n${rest}`);
  });

  it("takes an intro that starts with emphasis", () => {
    expect(upsertAuthoringGuide("# Title\n\n**Bold** intro.\n\nMore.\n")).toBe(
      `# Title\n\n**Bold** intro.\n\n${block}\n\nMore.\n`
    );
  });

  it("prepends the guide when there is no heading", () => {
    expect(upsertAuthoringGuide("Just text.\n")).toBe(`${block}\n\nJust text.\n`);
  });

  it("replaces an existing block in place and is stable", () => {
    const stale = `# Title\n\n${AUTHORING_GUIDE_START}\nold wording\n${AUTHORING_GUIDE_END}\n\n## Contents\n`;
    const refreshed = upsertAuthoringGuide(stale);
    expect(refreshed).toBe(`# Title\n\n${block}\n\n## Contents\n`);
    expect(upsertAuthoringGuide(refreshed)).toBe(refreshed);
  });

  it("ignores an end marker that comes before the start marker", () => {
    const body = upsertAuthoringGuide(`${AUTHORING_GUIDE_END}\n${AUTHORING_GUIDE_START}\n`);
    expect(body.startsWith(block)).toBe(true);
  });
});
