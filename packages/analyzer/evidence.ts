import type { Analysis, SymbolNode } from "../shared/model.ts";
export function explain(a: Analysis, id: string) {
  const occurrences = a.checkpoints.flatMap((c) => {
    const s = c.files.flatMap((f) => f.symbols).find((s) => s.id === id);
    return s ? [{ checkpoint: c.ref, commit: c.commit, symbol: s }] : [];
  });
  if (!occurrences.length) throw Error("Unknown symbol");
  const first = occurrences[0];
  const evidence = occurrences
    .filter(
      (o, i) =>
        !i ||
        o.symbol.contentHash !== occurrences[i - 1].symbol.contentHash ||
        o.symbol.path !== occurrences[i - 1].symbol.path ||
        o.symbol.name !== occurrences[i - 1].symbol.name,
    )
    .map((o, i) => ({
      id: `E${i + 1}`,
      sha: o.commit.sha,
      subject: o.commit.subject,
      author: o.commit.author,
      path: o.symbol.path,
      line: o.symbol.line,
      name: o.symbol.name,
      claim:
        i === 0
          ? `First observed as ${o.symbol.name} in ${o.symbol.path} at this analyzed checkpoint.`
          : `Changed or moved to ${o.symbol.path}:${o.symbol.line} as ${o.symbol.name}.`,
      confidence: o.symbol.confidence,
      kind:
        i === 0
          ? "Git checkpoint evidence"
          : "Git checkpoint / heuristic lineage",
    }));
  return {
    symbol: occurrences.at(-1)!.symbol,
    evidence,
    occurrences,
    summary: `${first.symbol.name} first appears in the analyzed checkpoints with “${first.commit.subject}”. This is historical context, not proof of author intent.`,
    caveat:
      "Checkpoints are sampled. First observed is not necessarily the exact introduction commit. Lineage across renames is heuristic.",
  };
}
export function cochanges(
  a: Analysis,
  id: string,
): { path: string; count: number }[] {
  const counts = new Map<string, number>();
  for (let i = 1; i < a.checkpoints.length; i++) {
    const before = a.checkpoints[i - 1];
    const after = a.checkpoints[i];
    const find = (c: typeof before): SymbolNode | undefined =>
      c.files.flatMap((f) => f.symbols).find((s) => s.id === id);
    const x = find(before),
      y = find(after);
    if (!x || !y || x.contentHash === y.contentHash) continue;
    for (const f of after.files) {
      if (f.path === y.path) continue;
      const old = before.files.find((o) => o.path === f.path);
      if (!old || old.hash !== f.hash)
        counts.set(f.path, (counts.get(f.path) || 0) + 1);
    }
  }
  return [...counts]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}
