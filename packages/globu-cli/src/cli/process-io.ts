import fs from "node:fs";
import type { Io } from "./run.js";

export const processIo: Io = {
  out: (text) => console.log(text),
  err: (text) => console.error(text),
  stdin: () => fs.readFileSync(0, "utf8"),
  cwd: process.cwd()
};
