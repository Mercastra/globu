import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";

export function readConfig<Schema extends z.ZodType>(filePath: string, schema: Schema): z.infer<Schema> {
  let raw: unknown = {};
  if (fs.existsSync(filePath)) {
    try {
      raw = YAML.parse(fs.readFileSync(filePath, "utf8")) ?? {};
    } catch (err) {
      throw new Error(`${filePath} is not valid YAML: ${(err as Error).message}`);
    }
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`${filePath} is invalid:\n${z.prettifyError(result.error)}`);
  return result.data;
}

export function writeConfig(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, YAML.stringify(data, { lineWidth: 0 }));
}
