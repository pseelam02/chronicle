import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { launch } from "./runtime.ts";
import { fixture } from "./fixture.ts";
test("production CLI analyzes fixture and replays genuine progress", async () => {
  const f = await fixture();
  const s = await launch([f.root, "--force", "--no-ai"]);
  try {
    await s.ready();
    const a = await fetch(s.origin + "/api/analysis", {
      headers: s.headers,
    }).then((r) => r.json());
    assert.equal(a.commits.length, 4);
    const status = await fetch(s.origin + "/api/status", {
      headers: s.headers,
    }).then((r) => r.json());
    assert.ok(
      status.progress.some(
        (p: { stage: string }) => p.stage === "Parsing TypeScript",
      ),
    );
    const r = await fetch(s.origin + `/api/diff?from=${a.head}&to=STAGED`, {
      headers: s.headers,
    });
    assert.match((await r.json()).diff, /a < 0/);
    await assert.rejects(() =>
      launch(["--demo", "--port", new URL(s.origin).port]),
    );
  } finally {
    await s.stop();
    await f.cleanup();
  }
});
test("CLI help, version and invalid repository", async () => {
  const exec = promisify(execFile);
  assert.match(
    (await exec(process.execPath, ["dist/cli.js", "--help"])).stdout,
    /--no-ai/,
  );
  assert.match(
    (await exec(process.execPath, ["dist/cli.js", "--version"])).stdout,
    /0.1.0/,
  );
  await assert.rejects(() =>
    exec(process.execPath, ["dist/cli.js", "/does/not/exist", "--no-open"]),
  );
});
