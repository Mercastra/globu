import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { bundle, packageDir, pluginDir, readJson, root, writeJson } from "./targets.ts";

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

const manifest = readJson<PackageManifest>(path.join(packageDir, "package.json"));
const output = execFileSync("npm", ["pack", packageDir, "--json", "--pack-destination", releaseDir], {
  encoding: "utf8"
});
const [packed] = JSON.parse(output) as Packed[];
if (!packed.files.some((file) => file.path === bundle)) {
  throw new Error(`${manifest.name}: ${bundle} is missing from the tarball, run npm run build first`);
}

const pluginName = `${path.basename(pluginDir)}-plugin`;
const dependencies = { [manifest.name]: manifest.version };
const unscoped = manifest.name.split("/").at(-1);
writeJson(path.join(pluginDir, "package.json"), { name: pluginName, private: true, dependencies });
writeJson(path.join(pluginDir, "package-lock.json"), {
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

const pluginManifestPath = path.join(pluginDir, ".claude-plugin", "plugin.json");
writeJson(pluginManifestPath, { ...readJson<object>(pluginManifestPath), version: manifest.version });

console.log(`pinned ${path.relative(root, pluginDir)} to ${manifest.name}@${manifest.version}`);
console.log(`  publish with: npm publish ./${path.relative(root, path.join(releaseDir, packed.filename))}`);
