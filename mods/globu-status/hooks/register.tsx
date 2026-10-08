import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";

import type { KnowledgeNeed } from "../types";
import {
  colorOf,
  dateOf,
  detailOf,
  dirOf,
  empty,
  hasActivity,
  isCommitCommand,
  isHidden,
  isKnowledgeLogCommand,
  isMarkdownPath,
  isTemporaryPath,
  isUpdateSkill,
  isWritingCommand,
  levelOf,
  parentOf,
  saved,
  statusOf,
  summaryOf,
  WEEK_MS
} from "./need";

const need = atom({ plugin: "globu-status", key: "need" } as const, empty());
const hiddenUntil = atom({ plugin: "globu-status", key: "hiddenUntil" } as const, null);

const HIDDEN_KEY = "hiddenUntil";

const COMMAND = "globu-status";
const UPDATE_COMMANDS = ["globu:update-knowledge", "knowledge-base:update-knowledge", "globu:save-knowledge"];
const UPDATE_PROMPT = "Update the knowledge base with what this session learned.";
const BASE_DEPTH = 8;

type Dollar = EngineInterface;

let turnHadActivity = false;

const change = async ($: Dollar, fn: (value: KnowledgeNeed) => KnowledgeNeed) => {
  const value = await update($, need, fn);
  $.ui.status(statusOf(value));
  return value;
};

const markUpdated = async ($: Dollar, isUpdating = false) => {
  turnHadActivity = false;
  return change($, () => ({ ...saved(Date.now()), isUpdating }));
};

const hide = async ($: Dollar, until: number | null) => {
  await update($, hiddenUntil, () => until);
  try {
    if (until === null) await $.store.delete(HIDDEN_KEY);
    else await $.store.set(HIDDEN_KEY, until);
  } catch {}
};

const restoreHidden = async ($: Dollar) => {
  try {
    const stored = await $.store.get(HIDDEN_KEY);
    if (typeof stored === "number") await update($, hiddenUntil, () => stored);
  } catch {}
};

const isKnowledgeBasePath = async ($: Dollar, path: string): Promise<boolean> => {
  if (!isMarkdownPath(path)) return false;
  let dir: string | null = dirOf(path);
  for (let depth = 0; dir !== null && depth < BASE_DEPTH; depth += 1) {
    try {
      const [hasIndex, hasLog] = await Promise.all([$.fs.exists(`${dir}/index.md`), $.fs.exists(`${dir}/log.md`)]);
      if (hasIndex && hasLog) return true;
    } catch {
      return false;
    }
    dir = parentOf(dir);
  }
  return false;
};

const updateCommandFor = async ($: Dollar): Promise<string> => {
  try {
    const names = new Set((await $.command.list()).map((one) => one.name));
    const found = UPDATE_COMMANDS.find((one) => names.has(one));
    return found === undefined ? UPDATE_PROMPT : `/${found}`;
  } catch {
    return UPDATE_PROMPT;
  }
};

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description:
        'Show how much this session has done since its knowledge was last updated; "reset" marks it up to date, "show" brings the suggestions back.',
      argumentHint: "[reset|show]"
    });
    await restoreHidden($);
    $.ui.status(statusOf(await read($, need)));
    return next(e);
  });

  on("command.run", { command: COMMAND }, async ($, e) => {
    if (e.args.trim() === "reset") {
      await markUpdated($);
      return { text: "Knowledge marked up to date for this session." };
    }
    if (e.args.trim() === "show") {
      await hide($, null);
      return { text: "Knowledge update suggestions are shown again." };
    }
    const value = await read($, need);
    const until = await read($, hiddenUntil);
    const detail = hasActivity(value) ? `\n${detailOf(value)} since the knowledge was last updated.` : "";
    const hidden = isHidden(until, await $.clock.now())
      ? `\nSuggestions are hidden until ${dateOf(until as number)}.`
      : "";
    return { text: `knowledge: ${summaryOf(value)}${detail}${hidden}` };
  });

  on("tool.call", async ($, e, next) => {
    if (e.tool === "Skill" && isUpdateSkill(e.skill)) {
      await markUpdated($, true);
      return next(e);
    }

    const ran = await next(e);
    if (ran.deny !== undefined || ran.isError === true) return ran;

    if (e.tool === "Edit" || e.tool === "Write" || e.tool === "NotebookEdit") {
      const path = e.tool === "NotebookEdit" ? e.notebook_path : e.file_path;
      if (isTemporaryPath(path)) return ran;
      if (await isKnowledgeBasePath($, path)) {
        await markUpdated($);
        return ran;
      }
      turnHadActivity = true;
      await change($, (value) =>
        value.files.includes(path) ? value : { ...value, isUpdating: false, files: [...value.files, path] }
      );
      return ran;
    }

    if (e.tool === "Bash") {
      if (isKnowledgeLogCommand(e.command)) {
        await markUpdated($);
        return ran;
      }
      if (isCommitCommand(e.command)) {
        await change($, (value) =>
          hasActivity(value) ? { ...value, isUpdating: false, commits: value.commits + 1 } : value
        );
        return ran;
      }
      if (isWritingCommand(e.command)) {
        turnHadActivity = true;
        await change($, (value) => ({ ...value, isUpdating: false, shellWrites: value.shellWrites + 1 }));
      }
    }

    return ran;
  }).catch((_$, e, next) => next(e));

  on("turn.complete", async ($, e, next) => {
    if (e.agentId === undefined && turnHadActivity) {
      turnHadActivity = false;
      await change($, (value) => ({ ...value, isUpdating: false, turns: value.turns + 1 }));
    } else {
      await change($, (value) => (value.isUpdating ? { ...value, isUpdating: false } : value));
    }
    return next(e);
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const value = await read($, need);
    if (e.props.hasSurvey || (!hasActivity(value) && !value.isUpdating)) return next(e);
    if (isHidden(await read($, hiddenUntil), await $.clock.now())) return next(e);

    const { Box, Button, Text } = $.ui.resolve(e);
    const level = levelOf(value);
    const color = colorOf(level);

    return (
      <Box gap={1}>
        <Text color={color} dimColor={color === undefined} bold={level === "strong"}>
          {summaryOf(value)}
        </Text>
        {level !== "none" && (
          <Button
            key="update"
            label="Update knowledge"
            hotkey="k"
            variant="primary"
            onPress={async () => {
              const text = await updateCommandFor($);
              await $.prompt.submit({ text });
            }}
          />
        )}
        {level !== "none" && <Button key="mark" label="Mark up to date" hotkey="m" onPress={() => markUpdated($)} />}
        {level !== "none" && (
          <Button
            key="hide"
            label="Hide for a week"
            hotkey="h"
            dimColor
            onPress={async () => hide($, (await $.clock.now()) + WEEK_MS)}
          />
        )}
      </Box>
    );
  });
};
