import { test } from "node:test";
import assert from "node:assert/strict";
import { demo } from "../packages/analyzer/demo.ts";
import {
  blast,
  temporalIndex,
  matchLineage,
} from "../packages/analyzer/temporal.ts";
import { parseFile } from "../packages/analyzer/parser.ts";
test("temporal index reconstructs checkpoint membership", () => {
  const a = demo();
  const index = temporalIndex(a.checkpoints);
  const id = a.checkpoints[0].files[0].symbols[0].id;
  assert.equal(index.nodes[id].length, 6);
});
test("ambiguous structural matches are candidates rather than false stable IDs", () => {
  const a = demo().checkpoints[0];
  a.files = [parseFile("a.ts", "export function a() { return 1 }")];
  const b = structuredClone(a);
  b.files = [
    parseFile(
      "b.ts",
      "export function b() { return 1 }\nexport function c() { return 1 }",
    ),
  ];
  matchLineage(a, b);
  assert.notEqual(b.files[0].symbols[0].id, a.files[0].symbols[0].id);
  assert.equal(b.files[0].symbols[0].lineage?.[0].kind, "split");
});
test("file-only changes seed conservative blast radius", () => {
  const a = demo().checkpoints.at(-1)!;
  const b = structuredClone(a);
  b.files[0].hash = "changed";
  assert.ok(blast(a, b).some((i) => i.id === `file:${b.files[0].path}`));
});
