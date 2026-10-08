export type KnowledgeNeedLevel = "none" | "low" | "medium" | "strong";

export type KnowledgeNeed = {
  files: string[];
  shellWrites: number;
  commits: number;
  turns: number;
  updatedAt: number | null;
  isUpdating: boolean;
};

declare module "claude-code" {
  interface PluginState {
    "globu-status": { need: KnowledgeNeed; hiddenUntil: number | null };
  }
}
