#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseArgs, HELP } from "./args.ts";
import { VERSION } from "../shared/model.ts";
import { discover } from "../analyzer/git.ts";
import { startServer } from "./server.ts";
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(HELP);
    return;
  }
  if (args.includes("--version")) {
    console.log(VERSION);
    return;
  }
  const options = parseArgs(args);
  const root = options.demo ? "" : await discover(options.path);
  const s = await startServer(root, options);
  console.log(
    `\n  CHRONICLE · ${options.demo ? "Offline demo" : "Local Git time machine"}\n  ${s.origin}\n  Session link is opened in your browser. Press Ctrl+C to stop.\n`,
  );
  if (options.open) {
    const cmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "rundll32"
          : "xdg-open";
    const params =
      process.platform === "win32"
        ? ["url.dll,FileProtocolHandler", s.url]
        : [s.url];
    const child = spawn(cmd, params, {
      stdio: "ignore",
      detached: true,
      shell: false,
    });
    child.on("error", () =>
      console.error(
        "Could not open browser. Restart with --no-open and use the session link.",
      ),
    );
    child.unref();
  } else console.log(`Local session (keep private): ${s.url}`);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await s.close();
    process.exitCode = 0;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
main().catch((e: NodeJS.ErrnoException) => {
  console.error(
    e.code === "EADDRINUSE"
      ? "Chronicle: port is busy. Choose another --port or omit it."
      : "Chronicle: unable to start. Check the repository path, Git installation, and CLI options.",
  );
  process.exitCode = 1;
});
