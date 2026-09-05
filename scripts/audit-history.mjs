import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
try {
  process.loadEnvFile(".env.local");
} catch {
  /* Optional exact-key check. */
}
const secret = process.env.OPENAI_API_KEY;
const sensitive =
  /sk-(?:proj-)?[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{25,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/;
const history = execFileSync("git", ["log", "--all", "-p", "--format="], {
  maxBuffer: 40_000_000,
}).toString();
if (sensitive.test(history) || (secret && history.includes(secret)))
  throw Error("Secret-like material detected in Git history");
for (const p of [
  "dist/cli.js",
  "dist/worker.js",
  ...readdirSync("dist/web").map((f) => "dist/web/" + f),
]) {
  const content = readFileSync(p, "utf8");
  if (sensitive.test(content) || (secret && content.includes(secret)))
    throw Error("Secret-like material detected in built artifact");
}
console.log(
  "PASS: all Git history and production bundles scanned; no keys or secret-like material detected.",
);
