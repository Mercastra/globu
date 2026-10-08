import fs from "node:fs";
import path from "node:path";

export const root = path.join(import.meta.dirname, "..");
export const packageDir = path.join(root, "packages/globu-cli");
export const pluginDir = path.join(root, "plugins/globu");
export const entry = "src/bin/globu.ts";
export const bundle = "dist/globu.mjs";

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
