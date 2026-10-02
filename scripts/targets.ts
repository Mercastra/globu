import fs from "node:fs";
import path from "node:path";

export const root = path.join(import.meta.dirname, "..");

export type Target = { packageDir: string; pluginDir: string; entry: string; bundle: string };

export const targets: Target[] = [
  {
    packageDir: path.join(root, "packages/knowledge-base-cli"),
    pluginDir: path.join(root, "plugins/knowledge-base"),
    entry: "src/bin/knowledge-base.ts",
    bundle: "dist/knowledge-base.mjs"
  },
  {
    packageDir: path.join(root, "packages/globu-cli"),
    pluginDir: path.join(root, "plugins/globu"),
    entry: "src/bin/globu.ts",
    bundle: "dist/globu.mjs"
  }
];

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
