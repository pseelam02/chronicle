import os from "node:os";
import path from "node:path";
import { mkdir, readFile, rename, writeFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { git, safeRead } from "./git.ts";
import { hash } from "./parser.ts";
import { VERSION, type Analysis, type Options } from "../shared/model.ts";
export function cacheDir() {
  return process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Caches", "chronicle")
    : process.platform === "win32"
      ? path.join(
          process.env.LOCALAPPDATA ||
            path.join(os.homedir(), "AppData", "Local"),
          "chronicle",
          "Cache",
        )
      : path.join(
          process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"),
          "chronicle",
        );
}
export async function cacheKey(root: string, o: Options) {
  const status = await git(root, ["status", "--porcelain=v1", "-z"]);
  const names = (
    await git(root, [
      "ls-files",
      "--modified",
      "--others",
      "--exclude-standard",
      "-z",
    ])
  )
    .split("\0")
    .filter((p) => /\.tsx?$/.test(p))
    .slice(0, 1500);
  const content = [];
  for (const p of names) {
    try {
      content.push(p + hash(await safeRead(root, p)));
    } catch {
      content.push(p + "missing");
    }
  }
  return hash(
    JSON.stringify([
      root,
      await git(root, ["rev-parse", "HEAD"]),
      await git(root, ["for-each-ref", "--format=%(refname) %(objectname)"]),
      await git(root, [
        "diff",
        "--cached",
        "--raw",
        "--no-ext-diff",
        "--no-textconv",
      ]),
      status,
      content,
      VERSION,
      "typescript-5.9.3",
      o.ref,
      o.checkpoints,
    ]),
  );
}
export async function readCache(
  key: string,
  dir = cacheDir(),
): Promise<Analysis | undefined> {
  try {
    const p = path.join(dir, key + ".json");
    if ((await stat(p)).size > 100_000_000) return;
    const a = JSON.parse(await readFile(p, "utf8"));
    if (
      a.version === 1 &&
      Array.isArray(a.checkpoints) &&
      Array.isArray(a.commits)
    )
      return a;
  } catch {
    /* Rebuild corrupt or absent cache. */
  }
}
export async function writeCache(key: string, a: Analysis, dir = cacheDir()) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const dest = path.join(dir, key + ".json");
  const tmp = dest + "." + randomUUID() + ".tmp";
  await writeFile(tmp, JSON.stringify(a), { mode: 0o600 });
  await rename(tmp, dest);
}
