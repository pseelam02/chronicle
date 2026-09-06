import { mkdtemp, mkdir, writeFile, rm, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { git } from "../packages/analyzer/git.ts";
export async function fixture() {
  const root = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "chronicle-fixture-")),
  );
  await git(root, ["init", "-b", "main"]);
  await git(root, ["config", "user.name", "Chronicle Test"]);
  await git(root, ["config", "user.email", "test@example.invalid"]);
  const save = async (p: string, s: string) => {
    await mkdir(path.dirname(path.join(root, p)), { recursive: true });
    await writeFile(path.join(root, p), s);
  };
  const commit = async (s: string) => {
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", s]);
  };
  await save(
    "src/math.ts",
    "export function sum(a: number, b: number) { return a + b; }",
  );
  await commit("feat: introduce sum to total invoices");
  await git(root, ["tag", "v0.1"]);
  await save(
    "src/api.ts",
    "import { sum } from './math'; export function GET() { return sum(2, 3); }",
  );
  await commit("feat: expose invoice endpoint");
  await git(root, ["mv", "src/math.ts", "src/totals.ts"]);
  await save(
    "src/api.ts",
    "import { sum } from './totals'; export function GET() { return sum(2, 3); }",
  );
  await commit("refactor: move invoice totals");
  await save(
    "src/totals.ts",
    "export function total(a: number, b: number) { return a + b; }",
  );
  await save(
    "src/api.ts",
    "import { total } from './totals'; export function GET() { return total(2, 3); }",
  );
  await commit("refactor: rename sum to total");
  await save(
    "src/totals.ts",
    "export function total(a: number, b: number) { if (a < 0) return b; return a + b; }",
  );
  await git(root, ["add", "src/totals.ts"]);
  await save("src/extra.ts", "export interface Invoice { amount: number }");
  return {
    root,
    save,
    commit,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
