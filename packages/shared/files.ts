import type { FileNode, SymbolNode } from "./model.ts";
export function fileSymbol(file: FileNode): SymbolNode {
  return {
    id: `file:${file.path}`,
    name: file.path.split("/").at(-1)!,
    qualified: file.path,
    path: file.path,
    kind: /\.(test|spec)\.tsx?$/.test(file.path) ? "test" : "file",
    line: 1,
    end: Math.max(1, ...file.symbols.map((s) => s.end)),
    signature: `Module with ${file.symbols.length} declarations and ${file.imports.length} imported bindings`,
    fingerprint: file.hash,
    contentHash: file.hash,
    complexity: file.symbols.reduce((n, s) => n + s.complexity, 0),
    exported: false,
    confidence: 1,
    evidence: "Git tree entry and parsed TypeScript module",
  };
}
