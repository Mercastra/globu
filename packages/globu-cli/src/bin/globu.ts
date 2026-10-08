import { processIo } from "../cli/process-io.js";
import { globuMain } from "../globu.js";

process.exitCode = globuMain(process.argv.slice(2), processIo);
