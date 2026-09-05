import { spawn } from "node:child_process";
import path from "node:path";
export async function launch(
  args: string[],
  executable = path.resolve("dist/cli.js"),
  env: NodeJS.ProcessEnv = process.env,
) {
  const child = spawn(process.execPath, [executable, ...args, "--no-open"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let errors = "";
  child.stderr.on("data", (c) => {
    errors += c.toString();
  });
  const url = await new Promise<string>((resolve, reject) => {
    const t = setTimeout(() => {
      child.kill();
      reject(Error("CLI did not start"));
    }, 15000);
    child.stdout.on("data", (c) => {
      output += c.toString();
      const found = output.match(/http:\/\/127\.0\.0\.1:\d+\/#([a-f0-9]{64})/);
      if (found) {
        clearTimeout(t);
        resolve(found[0]);
      }
    });
    child.on("exit", () => {
      clearTimeout(t);
      reject(Error("CLI exited: " + errors));
    });
  });
  const parsed = new URL(url);
  const headers = { Authorization: `Bearer ${parsed.hash.slice(1)}` };
  const origin = parsed.origin;
  return {
    child,
    url,
    origin,
    headers,
    stop: async () => {
      if (child.exitCode !== null) return;
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          child.kill("SIGKILL");
          reject(Error("Graceful shutdown timed out"));
        }, 7000);
        child.once("exit", () => {
          clearTimeout(t);
          resolve();
        });
        child.kill("SIGINT");
      });
    },
    ready: async () => {
      for (let i = 0; i < 200; i++) {
        const s = await fetch(origin + "/api/status", { headers }).then((r) =>
          r.json(),
        );
        if (s.error) throw Error(s.error);
        if (s.ready) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw Error("Analysis timeout");
    },
  };
}
