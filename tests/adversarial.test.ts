import { test } from "node:test";
import assert from "node:assert/strict";
import { symlink, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fixture } from "./fixture.ts";
import { git, safeRead } from "../packages/analyzer/git.ts";
import { analyze } from "../packages/analyzer/engine.ts";
import { parseArgs } from "../packages/cli/args.ts";
import { readCache } from "../packages/analyzer/cache.ts";
import { launch } from "./runtime.ts";
test("malicious paths, hooks and scripts are inert", async () => {
  const f = await fixture();
  try {
    await f.save(
      "src/$(touch hacked).ts",
      "export function harmless() { return 1 }",
    );
    await f.save("package.json", '{"scripts":{"prepare":"touch EXECUTED"}}');
    await git(f.root, ["config", "core.fsmonitor", "touch EXECUTED"]);
    await symlink(
      path.join(f.root, ".."),
      path.join(f.root, "src-escape"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(() => safeRead(f.root, "src-escape/outside.ts"));
    const a = await analyze(f.root, parseArgs(["--no-ai"]), () => {});
    assert.ok(
      a.checkpoints
        .at(-1)!
        .files.some((x) => x.path.includes("$(touch hacked)")),
    );
    await assert.rejects(() => readFile(path.join(f.root, "EXECUTED")));
    await assert.rejects(() => readFile(path.join(f.root, "hacked")));
    await assert.rejects(() => safeRead(f.root, "../outside.ts"));
  } finally {
    await f.cleanup();
  }
});
test("corrupt cache is rejected", async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.root, "corrupt.json"), '{"version":');
    assert.equal(await readCache("corrupt", f.root), undefined);
  } finally {
    await f.cleanup();
  }
});
test("empty repository worker failure remains observable and shutdown works", async () => {
  const f = await fixture();
  const s = await launch([f.root, "--ref", "nonexistent", "--no-ai"]);
  try {
    let error = "";
    for (let i = 0; i < 100; i++) {
      const status = await fetch(s.origin + "/api/status", {
        headers: s.headers,
      }).then((r) => r.json());
      error = status.error;
      if (error) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.match(error, /Analysis failed/);
  } finally {
    await s.stop();
    await f.cleanup();
  }
});
test("bounded on-demand checkpoint and commit viewer", async () => {
  const f = await fixture();
  const s = await launch([f.root, "--checkpoints", "2", "--force", "--no-ai"]);
  try {
    await s.ready();
    const a = await fetch(s.origin + "/api/analysis", {
      headers: s.headers,
    }).then((r) => r.json());
    const sha = a.commits[1].sha;
    assert.ok(!a.checkpoints.some((c: { ref: string }) => c.ref === sha));
    const r = await fetch(s.origin + "/api/checkpoint", {
      method: "POST",
      headers: { ...s.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ sha }),
    });
    assert.equal(r.status, 200);
    assert.ok(
      (await r.json()).checkpoints.some((c: { ref: string }) => c.ref === sha),
    );
    const c = await fetch(s.origin + `/api/commit?sha=${sha}`, {
      headers: s.headers,
    }).then((r) => r.json());
    assert.match(c.diff, /GET/);
    assert.equal(
      (
        await fetch(s.origin + "/api/checkpoint", {
          method: "POST",
          headers: s.headers,
          body: JSON.stringify({ sha: "--help" }),
        })
      ).status,
      400,
    );
  } finally {
    await s.stop();
    await f.cleanup();
  }
});
