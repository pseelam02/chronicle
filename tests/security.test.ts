import { test } from "node:test";
import assert from "node:assert/strict";
import { launch } from "./runtime.ts";
import http from "node:http";
test("loopback runtime enforces session, origin, routing and graceful shutdown", async () => {
  const s = await launch(["--demo", "--no-ai"]);
  try {
    await s.ready();
    assert.equal((await fetch(s.origin + "/api/analysis")).status, 401);
    assert.equal(
      (
        await fetch(s.origin + "/api/status", {
          headers: { ...s.headers, Origin: "https://attacker.invalid" },
        })
      ).status,
      403,
    );
    assert.equal(
      await new Promise<number | undefined>((resolve, reject) => {
        http
          .get(
            s.origin + "/api/status",
            { headers: { ...s.headers, Host: "attacker.invalid" } },
            (res) => {
              res.resume();
              resolve(res.statusCode);
            },
          )
          .on("error", reject);
      }),
      403,
    );
    assert.equal(
      (await fetch(s.origin + "/api/git?command=push", { headers: s.headers }))
        .status,
      404,
    );
    assert.equal((await fetch(s.origin + "/.env.local")).status, 404);
    assert.equal(
      (
        await fetch(s.origin + "/api/synthesize", {
          method: "POST",
          headers: s.headers,
          body: "{}",
        })
      ).status,
      403,
    );
    const r = await fetch(s.origin + "/api/analysis", { headers: s.headers });
    const text = await r.text();
    assert.ok(!text.includes(s.headers.Authorization));
    assert.ok(!text.includes("OPENAI_API_KEY"));
    assert.equal(r.headers.get("referrer-policy"), "no-referrer");
  } finally {
    await s.stop();
  }
  await assert.rejects(() => fetch(s.origin));
});
