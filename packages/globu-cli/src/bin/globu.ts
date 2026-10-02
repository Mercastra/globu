import { processIo } from "../../../cli-common/src/process-io.js";
import { globuMain } from "../globu.js";

process.exitCode = globuMain(process.argv.slice(2), processIo);
