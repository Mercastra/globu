import { processIo } from "../../../cli-common/src/process-io.js";
import { knowledgeBaseMain } from "../knowledge-base.js";

process.exitCode = knowledgeBaseMain(process.argv.slice(2), processIo);
