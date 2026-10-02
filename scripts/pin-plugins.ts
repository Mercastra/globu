import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readJson, root, targets, writeJson } from "./targets.ts";

type PackageManifest = {
  name: string;
  version: string;
  license?: string;
  bin: Record<string, string>;
  engines: Record<string, string>;
};
type Packed = { filename: string; integrity: string; files: { path: string }[] };

const releaseDir = path.join(root, "release");
fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir);

for (const target of targets) {
  const manifest = readJson<PackageManifest>(path.join(target.packageDir, "package.json"));
  const output = execFileSync("npm", ["pack", target.packageDir, "--json", "--pack-destination", releaseDir], {
    encoding: "utf8"
  });
  const [packed] = JSON.parse(output) as Packed[];
  if (!packed.files.some((file) => file.path === target.bundle)) {
    throw new Error(`${manifest.name}: ${target.bundle} is missing from the tarball, run npm run build first`);
  }

  const pluginName = `${path.basename(target.pluginDir)}-plugin`;
  const dependencies = { [manifest.name]: manifest.version };
  const unscoped = manifest.name.split("/").at(-1);
  writeJson(path.join(target.pluginDir, "package.json"), { name: pluginName, private: true, dependencies });
  writeJson(path.join(target.pluginDir, "package-lock.json"), {
    name: pluginName,
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": { name: pluginName, dependencies },
      [`node_modules/${manifest.name}`]: {
        version: manifest.version,
        resolved: `https://registry.npmjs.org/${manifest.name}/-/${unscoped}-${manifest.version}.tgz`,
        integrity: packed.integrity,
        ...(manifest.license === undefined ? {} : { license: manifest.license }),
        bin: manifest.bin,
        engines: manifest.engines
      }
    }
  });

  const pluginManifestPath = path.join(target.pluginDir, ".claude-plugin", "plugin.json");
  writeJson(pluginManifestPath, { ...readJson<object>(pluginManifestPath), version: manifest.version });

  console.log(`pinned ${path.relative(root, target.pluginDir)} to ${manifest.name}@${manifest.version}`);
  console.log(`  publish with: npm publish ./${path.relative(root, path.join(releaseDir, packed.filename))}`);
}
