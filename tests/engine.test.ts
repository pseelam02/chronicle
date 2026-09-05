import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./fixture.ts";
import { analyze } from "../packages/analyzer/engine.ts";
import { parseArgs } from "../packages/cli/args.ts";
import { compare } from "../packages/analyzer/temporal.ts";
import { git } from "../packages/analyzer/git.ts";
test("real private checkout: history, staged, untracked and progress without mutation", async () => {
  const f = await fixture();
  try {
    const before = await git(f.root, ["status", "--porcelain=v1"]);
    const stages = new Set<string>();
    const a = await analyze(f.root, parseArgs(["--no-ai"]), (p) =>
      stages.add(p.stage),
    );
    assert.equal(a.commits.length, 4);
    assert.ok(stages.has("Parsing TypeScript"));
    const first = a.checkpoints[0].files[0].symbols[0];
    const last = a.checkpoints[3].files
      .flatMap((f) => f.symbols)
      .find((s) => s.name === "total")!;
    assert.equal(first.id, last.id);
    assert.ok(compare(a.checkpoints[3], a.checkpoints.at(-2)!).modified.length);
    assert.ok(
      a.checkpoints.at(-1)!.files.some((f) => f.path === "src/extra.ts"),
    );
    assert.equal(await git(f.root, ["status", "--porcelain=v1"]), before);
  } finally {
    await f.cleanup();
  }
});
