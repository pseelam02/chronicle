import { demo } from "../packages/analyzer/demo.ts";
import { synthesize } from "../packages/cli/ai.ts";
try {
  process.loadEnvFile(".env.local");
} catch {
  /* Environment-only credentials are also supported. */
}
if (!process.env.OPENAI_API_KEY) {
  console.error("LIVE AI NOT RUN: OPENAI_API_KEY is missing.");
  process.exitCode = 1;
} else {
  const a = demo();
  const id = a.checkpoints[0].files[0].symbols[0].id;
  try {
    const result = await synthesize(
      a,
      id,
      process.env.OPENAI_MODEL || "gpt-4.1-mini",
    );
    console.log(
      `LIVE AI PASS: synthetic evidence only, ${result.claims.length} validated cited claims; key never logged.`,
    );
  } catch (e) {
    console.error(`LIVE AI FAILED: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
