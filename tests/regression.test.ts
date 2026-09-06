import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFile, dependencies } from "../packages/analyzer/parser.ts";
import { compare, matchLineage } from "../packages/analyzer/temporal.ts";
import type { Checkpoint, Commit } from "../packages/shared/model.ts";
test("identifier-only implementation changes are not lost to normalized fingerprints", () => {
  const cp = (s: string): Checkpoint => ({
    ref: "x",
    label: "x",
    commit: {} as Commit,
    edges: [],
    files: [parseFile("x.ts", s)],
  });
  const a = cp("export function f() { return previous; }");
  const b = cp("export function f() { return next; }");
  matchLineage(a, b);
  assert.equal(compare(a, b).modified.length, 1);
});
test("heritage, type dependencies and aliased imports use AST evidence", () => {
  const a =
    "export interface User {}\nexport class Base {}\nexport function f() {}";
  const b =
    "import {User, Base, f as call} from './a';\nexport class Child extends Base implements User {}\nexport function run(u: User) { call(); }";
  const e = dependencies(
    [parseFile("a.ts", a), parseFile("b.ts", b)],
    new Map([
      ["a.ts", a],
      ["b.ts", b],
    ]),
  );
  for (const k of ["exports", "extends", "implements", "depends on", "calls"])
    assert.ok(
      e.some((x) => x.kind === k),
      k,
    );
});
