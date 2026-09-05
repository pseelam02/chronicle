import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./fixture.ts";
import { git, resolveRef } from "../packages/analyzer/git.ts";
import { analyze } from "../packages/analyzer/engine.ts";
import { parseArgs } from "../packages/cli/args.ts";
test("branches, annotated tags, merge checkpoints and staged baseline", async () => {
  const f = await fixture();
  try {
    await f.commit("chore: snapshot fixture changes");
    await git(f.root, ["switch", "-c", "feature"]);
    await f.save("src/branch.ts", "export type BranchContract = string");
    await f.commit("feat: add branch contract");
    await git(f.root, ["tag", "-a", "v0.2", "-m", "version 0.2"]);
    await git(f.root, ["switch", "main"]);
    await f.save("src/main.ts", "export function onlyMain(){return 4}");
    await f.commit("feat: add main function");
    const before = await git(f.root, ["status", "--porcelain"]);
    const a = await analyze(
      f.root,
      parseArgs(["--checkpoints", "2", "--no-ai"]),
      () => {},
    );
    assert.ok(a.refs.some((r) => r.name === "feature"));
    assert.ok(a.refs.some((r) => r.name === "v0.2"));
    assert.ok(a.checkpoints.some((c) => c.ref === f.root) === false);
    const tip = await resolveRef(f.root, "feature");
    assert.ok(a.checkpoints.some((c) => c.ref === tip));
    const head = a.checkpoints.find((c) => c.ref === a.head)!;
    const staged = a.checkpoints.find((c) => c.ref === "STAGED")!;
    assert.equal(
      head.files.flatMap((f) => f.symbols).find((s) => s.name === "onlyMain")
        ?.id,
      staged.files.flatMap((f) => f.symbols).find((s) => s.name === "onlyMain")
        ?.id,
    );
    assert.equal(await git(f.root, ["status", "--porcelain"]), before);
    await git(f.root, ["merge", "--no-ff", "feature", "-m", "merge feature"]);
    const merged = await analyze(f.root, parseArgs(["--no-ai"]), () => {});
    assert.ok(merged.commits.some((c) => c.parents.length === 2));
  } finally {
    await f.cleanup();
  }
});
