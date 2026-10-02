import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DOCS_DIRNAME, INDEX_FILENAME } from "./constants.js";
import { type Frontmatter, parseFrontmatter, textOf } from "./frontmatter.js";

export type Base = { name: string; description: string; docsDir: string; path: string };

const SKIPPED_DIRS = new Set(["node_modules", ".git", "target", "build", "dist", "out", ".gradle", ".venv"]);
const INDEX_SUFFIX = `${DOCS_DIRNAME}/${INDEX_FILENAME}`;

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function gitFiles(rootDir: string): string[] | null {
  try {
    const out = execFileSync("git", ["-C", rootDir, "ls-files", "-co", "--exclude-standard", "-z"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 512 * 1024 * 1024
    });
    return out.split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

function walkFiles(rootDir: string, dir: string = rootDir, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) walkFiles(rootDir, path.join(dir, entry.name), found);
    } else {
      found.push(toPosix(path.relative(rootDir, path.join(dir, entry.name))));
    }
  }
  return found;
}

export function isInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function readBaseIndex(docsDir: string): Frontmatter | null {
  try {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(docsDir, INDEX_FILENAME), "utf8"));
    return data.okf_version ? data : null;
  } catch {
    return null;
  }
}

export function findBases(rootDir: string): Base[] {
  const root = path.resolve(rootDir);
  const files = gitFiles(root) ?? walkFiles(root);
  const rootIsDocs = path.basename(root) === DOCS_DIRNAME;

  const bases: Base[] = [];
  for (const file of files) {
    const isCandidate =
      file === INDEX_SUFFIX || file.endsWith(`/${INDEX_SUFFIX}`) || (rootIsDocs && file === INDEX_FILENAME);
    if (!isCandidate) continue;
    const docsDir = path.dirname(path.join(root, file));
    const data = readBaseIndex(docsDir);
    if (!data) continue;
    bases.push({
      name: textOf(data.name) || path.basename(path.dirname(docsDir)),
      description: textOf(data.description),
      docsDir,
      path: toPosix(path.relative(root, docsDir)) || "."
    });
  }
  return bases.sort((a, b) => a.path.localeCompare(b.path));
}

export function ownerBase(filePath: string, stopAt?: string): string | null {
  const start = path.resolve(filePath);
  const limit = stopAt === undefined ? null : path.resolve(stopAt);
  let dir = fs.statSync(start, { throwIfNoEntry: false })?.isDirectory() ? start : path.dirname(start);

  while (true) {
    if (path.basename(dir) === DOCS_DIRNAME && readBaseIndex(dir)) return dir;
    const nested = path.join(dir, DOCS_DIRNAME);
    if (readBaseIndex(nested)) return nested;
    const parent = path.dirname(dir);
    if (dir === limit || parent === dir) return null;
    dir = parent;
  }
}
