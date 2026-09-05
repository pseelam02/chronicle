import { test } from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { validateSynthesis, synthesize } from "../packages/cli/ai.ts";
import { demo } from "../packages/analyzer/demo.ts";
test("SDK timeout is bounded and reported without credentials", async () => {
  const a = demo();
  const client = new OpenAI({
    apiKey: "test-credential",
    timeout: 20,
    maxRetries: 0,
    fetch: async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  });
  const started = Date.now();
  await assert.rejects(
    () =>
      synthesize(a, a.checkpoints[0].files[0].symbols[0].id, "test", client),
    /synthesis unavailable/,
  );
  assert.ok(Date.now() - started < 2000);
});
test("AI schema drops unsupported citations and rejects invalid output", () => {
  assert.throws(() =>
    validateSynthesis({ claims: [{ text: "invented", citations: ["E9"] }] }, [
      "E1",
    ]),
  );
  assert.throws(() => validateSynthesis(null, []));
  assert.equal(
    validateSynthesis({ claims: [{ text: "Observed", citations: ["E1"] }] }, [
      "E1",
    ]).claims.length,
    1,
  );
});
test("mocked OpenAI requests are bounded and errors redact secrets", async () => {
  const a = demo();
  const id = a.checkpoints[0].files[0].symbols[0].id;
  const client = {
    responses: {
      create: async (req: Record<string, unknown>) => {
        assert.equal(req.store, false);
        assert.ok(String(req.input).length < 16000);
        return {
          output_text: JSON.stringify({
            claims: [
              { text: "Observed in initial checkpoint", citations: ["E1"] },
            ],
          }),
        };
      },
    },
  } as unknown as OpenAI;
  assert.equal(
    (await synthesize(a, id, "test-model", client)).claims.length,
    1,
  );
  const bad = {
    responses: {
      create: async () => {
        throw Error("sensitive credential");
      },
    },
  } as unknown as OpenAI;
  await assert.rejects(
    () => synthesize(a, id, "test-model", bad),
    (e) => !(e as Error).message.includes("sensitive"),
  );
});
