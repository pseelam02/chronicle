import { parentPort, workerData } from "node:worker_threads";
import { analyze } from "../analyzer/engine.ts";
import { cacheKey, readCache, writeCache } from "../analyzer/cache.ts";
import { readFile } from "node:fs/promises";
async function run() {
  const { root, options } = workerData;
  if (options.demo) {
    parentPort?.postMessage({
      type: "result",
      data: JSON.parse(
        await readFile(new URL("./demo.json", import.meta.url), "utf8"),
      ),
    });
    return;
  }
  parentPort?.postMessage({
    type: "progress",
    data: {
      stage: "Inspecting repository",
      completed: 0,
      total: 1,
      detail: "Checking local cache",
    },
  });
  const key = await cacheKey(root, options);
  const cached = !options.force && (await readCache(key));
  if (cached) {
    parentPort?.postMessage({ type: "result", data: cached });
    return;
  }
  const data = await analyze(root, options, (p) =>
    parentPort?.postMessage({ type: "progress", data: p }),
  );
  parentPort?.postMessage({
    type: "progress",
    data: { stage: "Writing cache", completed: 0, total: 1, detail: "" },
  });
  try {
    await writeCache(key, data);
  } catch {
    data.warnings.push(
      "Cache could not be written; analysis is still available.",
    );
  }
  parentPort?.postMessage({ type: "result", data });
}
run().catch(() =>
  parentPort?.postMessage({
    type: "error",
    data: "Analysis failed. Check Git availability, repository readability, and resource limits. Retry with --force.",
  }),
);
