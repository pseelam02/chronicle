import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath, lstat, readFile } from "node:fs/promises";
import path from "node:path";
import type { Commit } from "../shared/model.ts";
const exec = promisify(execFile);
export async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await exec(
    "git",
    [
      "--no-pager",
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "diff.external=",
      "-C",
      root,
      ...args,
    ],
    {
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 24 * 1024 * 1024,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !key.startsWith("GIT_"),
          ),
        ),
        GIT_OPTIONAL_LOCKS: "0",
        GIT_TERMINAL_PROMPT: "0",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_NO_REPLACE_OBJECTS: "1",
        GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_NO_LAZY_FETCH: "1",
      },
    },
  );
  return stdout;
}
export async function discover(input: string) {
  const p = await realpath(path.resolve(input));
  return (await git(p, ["rev-parse", "--show-toplevel"])).trim();
}
export async function resolveRef(root: string, ref: string) {
  if (ref.startsWith("-") || ref.length > 200) throw Error("Invalid ref");
  return (
    await git(root, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${ref}^{commit}`,
    ])
  ).trim();
}
export async function history(root: string, sha: string): Promise<Commit[]> {
  const out = await git(root, [
    "log",
    "-2000",
    "--topo-order",
    "--format=%H%x00%P%x00%an%x00%aI%x00%s%x00%b%x00",
    sha,
    "--",
  ]);
  const fields = out.split("\0");
  const result: Commit[] = [];
  for (let i = 0; i + 5 < fields.length; i += 6) {
    result.push({
      sha: fields[i].trim(),
      parents: fields[i + 1].split(" ").filter(Boolean),
      author: fields[i + 2],
      timestamp: fields[i + 3],
      subject: fields[i + 4],
      body: fields[i + 5],
    });
  }
  return result.reverse();
}
export async function refs(root: string) {
  return (
    await git(root, [
      "for-each-ref",
      "--format=%(refname:short)%00%(objectname)",
      "refs/heads",
      "refs/tags",
    ])
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((s) => {
      const [name, sha] = s.split("\0");
      return { name, sha };
    });
}
export async function tree(root: string, ref: string) {
  const out = await git(root, ["ls-tree", "-rz", "--full-tree", ref]);
  return out
    .split("\0")
    .filter(Boolean)
    .flatMap((s) => {
      const tab = s.indexOf("\t");
      const [mode, type, hash] = s.slice(0, tab).split(" ");
      const p = s.slice(tab + 1);
      return type === "blob" &&
        mode !== "120000" &&
        /\.tsx?$/.test(p) &&
        !/(^|\/)(node_modules|dist|vendor|\.git)\//.test(p)
        ? [{ path: p, hash }]
        : [];
    });
}
export async function safeRead(root: string, p: string): Promise<string> {
  const target = path.resolve(root, p);
  if (!target.startsWith(root + path.sep))
    throw Error("Path outside repository");
  const st = await lstat(target);
  if (!st.isFile() || st.isSymbolicLink() || st.size > 1_000_000)
    throw Error("Unsupported file");
  const actual = await realpath(target);
  if (!actual.startsWith(root + path.sep))
    throw Error("Symlink escapes repository");
  return readFile(actual, "utf8");
}
export async function diff(root: string, from: string, to: string) {
  const a = await resolveRef(root, from);
  const args = [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--find-renames",
    "--unified=3",
  ];
  if (to === "WORKTREE") args.push(a);
  else if (to === "STAGED") args.push("--cached", a);
  else args.push(a, await resolveRef(root, to));
  return (await git(root, [...args, "--"])).slice(0, 120000);
}
