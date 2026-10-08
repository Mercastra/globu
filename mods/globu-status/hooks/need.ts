import type { KnowledgeNeed, KnowledgeNeedLevel } from "../types";

export const COMMIT_WEIGHT = 5;

export const empty = (): KnowledgeNeed => ({
  files: [],
  shellWrites: 0,
  commits: 0,
  turns: 0,
  updatedAt: null,
  isUpdating: false
});

export const saved = (at: number): KnowledgeNeed => ({ ...empty(), updatedAt: at });

export const scoreOf = (need: KnowledgeNeed): number =>
  need.files.length + need.shellWrites + need.commits * COMMIT_WEIGHT + need.turns;

export const levelOf = (need: KnowledgeNeed): KnowledgeNeedLevel => {
  const score = scoreOf(need);
  if (score === 0) return "none";
  if (score >= 9) return "strong";
  if (score >= 4 || need.commits > 0) return "medium";
  return "low";
};

export const hasActivity = (need: KnowledgeNeed): boolean => scoreOf(need) > 0;

const GLYPH: Record<KnowledgeNeedLevel, string> = {
  none: "○",
  low: "◔",
  medium: "◑",
  strong: "●"
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export const detailOf = (need: KnowledgeNeed): string => {
  const parts: string[] = [];
  const edits = need.files.length + need.shellWrites;
  if (edits > 0) parts.push(plural(edits, "edit"));
  if (need.commits > 0) parts.push(plural(need.commits, "commit"));
  if (need.turns > 0) parts.push(plural(need.turns, "turn"));
  return parts.join(", ");
};

const LABEL: Record<KnowledgeNeedLevel, string> = {
  none: "",
  low: "Low",
  medium: "Medium",
  strong: "Strong"
};

export const summaryOf = (need: KnowledgeNeed): string => {
  if (need.isUpdating) return "Updating knowledge...";
  const level = levelOf(need);
  if (level === "none") return need.updatedAt === null ? "○ Nothing to update yet" : "✓ Knowledge up to date";
  return `${GLYPH[level]} ${LABEL[level]} need to update knowledge (${detailOf(need)})`;
};

export const statusOf = (need: KnowledgeNeed): string => {
  if (need.isUpdating) return "updating...";
  const level = levelOf(need);
  if (level === "none") return need.updatedAt === null ? "○ nothing to update" : "✓ up to date";
  return `${GLYPH[level]} ${level}`;
};

export const colorOf = (level: KnowledgeNeedLevel): "success" | "warning" | "error" | undefined => {
  if (level === "low") return "success";
  if (level === "medium") return "warning";
  if (level === "strong") return "error";
  return undefined;
};

const TEMPORARY = /(^|\/)(tmp|temp|scratchpad|node_modules|dist|\.git)(\/|$)/;

export const isTemporaryPath = (path: string): boolean => TEMPORARY.test(path);

export const isMarkdownPath = (path: string): boolean => /\.(md|mdx)$/i.test(path);

export const dirOf = (path: string): string => path.replace(/\/[^/]*$/, "") || "/";

export const parentOf = (dir: string): string | null => {
  if (dir === "/" || !dir.includes("/")) return null;
  return dirOf(dir);
};

const UPDATE_SKILL = /(^|:)(save-knowledge|update-knowledge)$/;

export const isUpdateSkill = (skill: string): boolean => UPDATE_SKILL.test(skill.replace(/^\//, "").trim());

export const isCommitCommand = (command: string): boolean => /\bgit\b[^|;&\n]*\bcommit\b/.test(command);

export const isKnowledgeLogCommand = (command: string): boolean =>
  /knowledge-base(\.mjs)?\s+(log|validate)\b|globu(\.mjs)?\s+base\s+(log|validate)\b/.test(command);

const WRITES = /\bsed\s+(-[a-zA-Z]*i|--in-place)\b|\btee\b|\bcat\s*>|<<-?\s*['"]?\w+['"]?/;
const REDIRECT = /(^|[^<>&0-9])>{1,2}\s*(?![&\s]|\/dev\/)/;

export const isWritingCommand = (command: string): boolean => {
  if (isTemporaryPath(command)) return false;
  return WRITES.test(command) || REDIRECT.test(command);
};

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const isHidden = (hiddenUntil: number | null, now: number): boolean => hiddenUntil !== null && now < hiddenUntil;

export const dateOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
