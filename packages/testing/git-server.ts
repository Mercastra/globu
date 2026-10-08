import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { parentPort, workerData } from "node:worker_threads";

const { root, authorization, log } = workerData as { root: string; authorization: string | null; log: string };

function parseCgi(output: Buffer): { status: number; headers: string[]; body: Buffer } {
  const split = output.indexOf("\r\n\r\n");
  let status = 200;
  const headers: string[] = [];
  for (const line of output.subarray(0, split).toString().split("\r\n")) {
    const name = line.slice(0, line.indexOf(":"));
    const value = line.slice(name.length + 1).trim();
    if (name === "Status") status = Number.parseInt(value, 10);
    else headers.push(name, value);
  }
  return { status, headers, body: output.subarray(split + 4) };
}

const server = http.createServer((req, res) => {
  fs.appendFileSync(log, `${req.method} ${req.url} ${req.headers.authorization ?? "-"}\n`);
  if (authorization !== null && req.headers.authorization !== authorization) {
    res.writeHead(401).end();
    return;
  }
  const url = new URL(req.url as string, "http://localhost");
  const env = {
    ...process.env,
    GIT_PROJECT_ROOT: root,
    GIT_HTTP_EXPORT_ALL: "1",
    PATH_INFO: url.pathname,
    QUERY_STRING: url.search.slice(1),
    REQUEST_METHOD: req.method,
    CONTENT_TYPE: String(req.headers["content-type"] ?? ""),
    HTTP_CONTENT_ENCODING: String(req.headers["content-encoding"] ?? ""),
    GIT_PROTOCOL: String(req.headers["git-protocol"] ?? ""),
    REMOTE_ADDR: "127.0.0.1"
  };
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    const result = spawnSync("git", ["http-backend"], { env, input: Buffer.concat(chunks) });
    const { status, headers, body } = parseCgi(result.stdout);
    res.writeHead(status, headers);
    res.end(body);
  });
});

server.listen(0, "127.0.0.1", () => {
  parentPort?.postMessage((server.address() as AddressInfo).port);
});
