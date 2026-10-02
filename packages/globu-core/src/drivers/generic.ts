import fs from "node:fs";
import type { Detection, Driver } from "./types.js";

const README_RE = /^readme(\.(md|markdown|txt|rst))?$/i;

function detect(dir: string): Detection {
  const readme = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && README_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .at(0);
  return { description: "", roots: [readme === undefined ? { path: "." } : { path: ".", entry: readme }] };
}

export const genericDriver = {
  name: "generic",
  conventions:
    "This shard has no declared knowledge format. Start from the entry file if there is one and follow the conventions the existing files already use.",
  detect
} satisfies Driver;
