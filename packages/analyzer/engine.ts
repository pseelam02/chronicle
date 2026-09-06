import path from "node:path";
import { git, history, refs, resolveRef, tree, safeRead } from "./git.ts";
import { parseFile, dependencies, hash } from "./parser.ts";
import { matchLineage, selectCheckpoints, temporalIndex } from "./temporal.ts";
import type {
  Analysis,
  Checkpoint,
  FileNode,
  Options,
  Progress,
} from "../shared/model.ts";
export async function analyze(
  root: string,
  o: Options,
  progress: (p: Progress) => void,
): Promise<Analysis> {
  const emit = (stage: string, completed = 0, total = 1, detail = "") =>
    progress({ stage, completed, total, detail });
  emit("Inspecting repository");
  const head = await resolveRef(root, o.ref);
  emit("Reading Git history");
  const commits = await history(root, head);
  const allRefs = await refs(root);
  emit("Selecting checkpoints");
  const selected = selectCheckpoints(
    commits,
    o.checkpoints,
    allRefs.map((r) => r.sha),
  );
  const parsed = new Map<string, { file: FileNode; source: string }>();
  const warnings: string[] = [];
  const checkpoints: Checkpoint[] = [];
  const snapshot = async (
    ref: string,
    commit: Checkpoint["commit"],
    label: string,
  ) => {
    let entries: { path: string; hash: string }[] = [];
    if (ref === "STAGED") {
      entries = (await git(root, ["ls-files", "--stage", "-z"]))
        .split("\0")
        .filter(Boolean)
        .flatMap((s) => {
          const t = s.indexOf("\t");
          const [mode, h, stage] = s.slice(0, t).split(" ");
          return mode !== "120000" &&
            stage === "0" &&
            /\.tsx?$/.test(s.slice(t + 1))
            ? [{ path: s.slice(t + 1), hash: h }]
            : [];
        });
    } else if (ref === "WORKTREE") {
      entries = (
        await git(root, [
          "ls-files",
          "--cached",
          "--others",
          "--exclude-standard",
          "-z",
        ])
      )
        .split("\0")
        .filter((p) => /\.tsx?$/.test(p))
        .map((p) => ({ path: p, hash: "" }));
    } else entries = await tree(root, ref);
    entries = [...new Map(entries.map((e) => [e.path, e])).values()].filter(
      (e) => !/(^|\/)(node_modules|dist|vendor|\.git)\//.test(e.path),
    );
    if (entries.length > 1500) {
      warnings.push(`${label}: capped at 1500 TypeScript files`);
      entries = entries.slice(0, 1500);
    }
    const files: FileNode[] = [];
    const sources = new Map<string, string>();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      emit("Parsing TypeScript", i, entries.length, `${label} · ${e.path}`);
      try {
        let source = "";
        let cached = parsed.get(`${e.path}:${e.hash}`);
        if (!cached || ref === "WORKTREE") {
          if (ref === "WORKTREE") source = await safeRead(root, e.path);
          else {
            const size = Number(
              (await git(root, ["cat-file", "-s", e.hash])).trim(),
            );
            if (size > 1_000_000) throw Error("File exceeds 1 MB");
            source = await git(root, ["cat-file", "blob", e.hash]);
          }
          cached = { file: parseFile(e.path, source), source };
          parsed.set(`${e.path}:${e.hash || hash(source)}`, cached);
        }
        const file = structuredClone(cached.file);
        for (const s of file.symbols)
          s.id = hash(`${ref}:${s.id}`).slice(0, 20);
        files.push(file);
        sources.set(e.path, cached.source);
      } catch {
        warnings.push(
          `${label}: skipped unreadable or oversized file ${e.path}`,
        );
      }
    }
    emit("Resolving dependencies", 1, 1, label);
    const cp: Checkpoint = {
      ref,
      label,
      commit,
      files,
      edges: dependencies(files, sources),
    };
    emit("Matching symbol lineage", 1, 1, label);
    const previous =
      ref === "STAGED"
        ? checkpoints.find((c) => c.ref === actualHead)
        : checkpoints.at(-1);
    const renames = new Map<string, string>();
    if (
      previous &&
      /^[a-f0-9]{40,64}$/.test(previous.ref) &&
      /^[a-f0-9]{40,64}$/.test(ref)
    ) {
      const parts = (
        await git(root, [
          "diff",
          "--name-status",
          "-z",
          "--find-renames",
          "--no-ext-diff",
          "--no-textconv",
          previous.ref,
          ref,
          "--",
        ])
      ).split("\0");
      cp.changes = [];
      for (let i = 0; i < parts.length - 1;) {
        const status = parts[i++];
        const p = parts[i++];
        if (status.startsWith("R")) {
          const next = parts[i++];
          renames.set(p, next);
          cp.changes.push({ status, path: next, oldPath: p });
        } else cp.changes.push({ status, path: p });
      }
    }
    matchLineage(previous, cp, renames);
    checkpoints.push(cp);
  };
  for (const c of selected)
    await snapshot(
      c.sha,
      c,
      allRefs.find((r) => r.sha === c.sha)?.name || c.sha.slice(0, 7),
    );
  const actualHead = await resolveRef(root, "HEAD");
  for (const r of allRefs.slice(0, 20)) {
    const sha = await resolveRef(root, r.name);
    if (!checkpoints.some((c) => c.ref === sha)) {
      const c = (await history(root, sha)).at(-1);
      if (c) await snapshot(sha, c, r.name);
    }
    try {
      const base = (await git(root, ["merge-base", head, sha])).trim();
      if (!checkpoints.some((c) => c.ref === base)) {
        const c = (await history(root, base)).at(-1);
        if (c) await snapshot(base, c, `merge-base:${r.name}`);
      }
    } catch {
      /* Unrelated branch histories have no merge base. */
    }
  }
  if (allRefs.length > 20)
    warnings.push(
      "Only the first 20 branch/tag tips are preloaded; use the commit selector or --ref for others.",
    );
  const current =
    commits.find((c) => c.sha === actualHead) ||
    (await history(root, actualHead)).at(-1)!;
  if (actualHead !== head) {
    const c = (await history(root, actualHead)).at(-1)!;
    await snapshot(actualHead, c, "HEAD");
  }
  await snapshot(
    "STAGED",
    {
      ...current,
      sha: actualHead,
      author: "Local checkout",
      timestamp: new Date().toISOString(),
      subject: "Git index snapshot",
    },
    "Staged",
  );
  await snapshot(
    "WORKTREE",
    {
      ...current,
      sha: actualHead,
      author: "Local checkout",
      timestamp: new Date().toISOString(),
      subject: "Working tree including untracked TypeScript",
    },
    "Working tree",
  );
  emit("Building temporal graph", 1, 1);
  if (commits.length === 2000)
    warnings.push("History limited to the latest 2000 commits");
  return {
    version: 1,
    name: path.basename(root),
    head: actualHead,
    selectedRef: head,
    ref: o.ref,
    commits,
    refs: allRefs,
    checkpoints,
    analyzedAt: new Date().toISOString(),
    warnings: [...new Set(warnings)],
    temporal: temporalIndex(checkpoints),
  };
}
