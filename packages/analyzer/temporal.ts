import type { Checkpoint, Commit, SymbolNode } from "../shared/model.ts";
export function selectCheckpoints(
  commits: Commit[],
  limit: number,
  tags: string[] = [],
) {
  if (commits.length <= limit) return commits;
  const chosen = new Set([0, commits.length - 1]);
  for (
    let i = 0;
    i < commits.length && chosen.size < Math.floor(limit / 2);
    i++
  )
    if (tags.includes(commits[i].sha) || commits[i].parents.length > 1)
      chosen.add(i);
  for (let i = 1; chosen.size < limit && i < limit * 3; i++)
    chosen.add(
      Math.round((i * (commits.length - 1)) / (limit - 1)) % commits.length,
    );
  return [...chosen].sort((a, b) => a - b).map((i) => commits[i]);
}
export function matchLineage(
  previous: Checkpoint | undefined,
  next: Checkpoint,
) {
  if (!previous) return;
  const old = previous.files.flatMap((f) => f.symbols);
  const used = new Set<string>();
  const remap = new Map<string, string>();
  for (const n of next.files.flatMap((f) => f.symbols)) {
    let candidates = old.filter(
      (o) =>
        !used.has(o.id) && o.path === n.path && o.qualified === n.qualified,
    );
    let confidence = 1;
    let evidence = "Same file and qualified declaration";
    if (!candidates.length) {
      candidates = old.filter(
        (o) =>
          !used.has(o.id) &&
          o.kind === n.kind &&
          o.fingerprint === n.fingerprint,
      );
      confidence = 0.85;
      evidence =
        "Unique normalized AST fingerprint across adjacent checkpoints";
    }
    if (candidates.length === 1) {
      const o = candidates[0];
      used.add(o.id);
      remap.set(n.id, o.id);
      n.id = o.id;
      n.confidence = Math.min(confidence, o.confidence);
      n.evidence = evidence;
    }
  }
  for (const e of next.edges) {
    e.source = remap.get(e.source) || e.source;
    e.target = remap.get(e.target) || e.target;
  }
}
export function compare(a: Checkpoint, b: Checkpoint) {
  const before = new Map(
    a.files.flatMap((f) => f.symbols).map((s) => [s.id, s]),
  );
  const after = new Map(
    b.files.flatMap((f) => f.symbols).map((s) => [s.id, s]),
  );
  const added: SymbolNode[] = [];
  const removed: SymbolNode[] = [];
  const modified: SymbolNode[] = [];
  const moved: SymbolNode[] = [];
  for (const s of after.values()) {
    const old = before.get(s.id);
    if (!old) added.push(s);
    else {
      if (old.name !== s.name || old.path !== s.path) moved.push(s);
      if (old.contentHash !== s.contentHash) modified.push(s);
    }
  }
  for (const s of before.values()) if (!after.has(s.id)) removed.push(s);
  const key = (e: Checkpoint["edges"][number]) =>
    `${e.source}:${e.target}:${e.kind}`;
  return {
    added,
    removed,
    modified,
    moved,
    edgesAdded: b.edges.filter((e) => !a.edges.some((x) => key(x) === key(e))),
    edgesRemoved: a.edges.filter(
      (e) => !b.edges.some((x) => key(x) === key(e)),
    ),
    complexity:
      b.files.flatMap((f) => f.symbols).reduce((n, s) => n + s.complexity, 0) -
      a.files.flatMap((f) => f.symbols).reduce((n, s) => n + s.complexity, 0),
  };
}
export function blast(a: Checkpoint, b: Checkpoint) {
  const changes = compare(a, b);
  const changed = new Set(
    [
      ...changes.added,
      ...changes.modified,
      ...changes.moved,
      ...changes.removed,
    ].flatMap((s) => [s.id, `file:${s.path}`]),
  );
  const affected = new Map(
    [...changed].map((id) => [id, "Directly changed declaration or file"]),
  );
  const edges = [...a.edges, ...b.edges];
  let grew = true;
  while (grew && affected.size < 10000) {
    grew = false;
    for (const e of edges)
      if (affected.has(e.target) && !affected.has(e.source)) {
        affected.set(e.source, `${e.kind} → ${e.target}: ${e.evidence}`);
        grew = true;
      }
  }
  return [...affected].map(([id, reason]) => ({
    id,
    reason,
    node:
      b.files.flatMap((f) => f.symbols).find((s) => s.id === id) ||
      a.files.flatMap((f) => f.symbols).find((s) => s.id === id),
  }));
}
