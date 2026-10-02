import { findBases, INDEX_FILENAME } from "../../../knowledge-base/src/index.js";
import type { Driver } from "./types.js";

function depth(basePath: string): number {
  return basePath.split("/").length;
}

export const okfDriver: Driver = {
  name: "okf",
  conventions: `Each root is an OKF base. Read the root's ${INDEX_FILENAME} first: it lists the contents and carries the authoring guide, which is the rulebook for any edit. Knowledge about a piece of code belongs in the nearest base walking up from that code.`,
  detect(dir) {
    const bases = findBases(dir);
    if (bases.length === 0) return null;
    const described = [...bases].sort((a, b) => depth(a.path) - depth(b.path)).find((base) => base.description);
    return {
      description: described?.description ?? "",
      roots: bases.map((base) => ({
        path: base.path,
        name: base.name,
        entry: base.path === "." ? INDEX_FILENAME : `${base.path}/${INDEX_FILENAME}`
      }))
    };
  }
};
