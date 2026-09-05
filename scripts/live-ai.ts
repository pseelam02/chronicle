import { launch } from "../tests/runtime.ts";
import { validateSynthesis } from "../packages/cli/ai.ts";
import assert from "node:assert/strict";
try {
  process.loadEnvFile(".env.local");
} catch {
  /* Environment-only credentials are also supported. */
}
if (!process.env.OPENAI_API_KEY) {
  console.error("LIVE AI NOT RUN: OPENAI_API_KEY is missing.");
  process.exitCode = 1;
} else {
  const server = await launch(["--demo"]);
  try {
    await server.ready();
    const a = await fetch(server.origin + "/api/analysis", {
      headers: server.headers,
    }).then((r) => r.json());
    const id = a.checkpoints[0].files[0].symbols[0].id;
    const evidence = await fetch(server.origin + `/api/ai-preview?id=${id}`, {
      headers: server.headers,
    }).then((r) => r.json());
    const denied = await fetch(server.origin + "/api/synthesize", {
      method: "POST",
      headers: server.headers,
      body: JSON.stringify({ id, consent: false }),
    });
    assert.equal(denied.status, 400);
    const response = await fetch(server.origin + "/api/synthesize", {
      method: "POST",
      headers: server.headers,
      body: JSON.stringify({ id, consent: true }),
    });
    const payload = await response.json();
    if (!response.ok) throw Error(payload.error);
    assert.ok(!JSON.stringify(payload).includes(process.env.OPENAI_API_KEY));
    const result = validateSynthesis(
      payload,
      evidence.map((e: { id: string }) => e.id),
    );
    console.log(
      `LIVE AI PASS: CLI/server consent gate, official provider authentication, ${result.claims.length} validated cited claims, no key in browser responses. Synthetic evidence only.`,
    );
  } catch (e) {
    console.error(`LIVE AI FAILED: ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    await server.stop();
  }
}
