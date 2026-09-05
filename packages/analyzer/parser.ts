import ts from "typescript";
import { createHash } from "node:crypto";
import type { FileNode, SymbolNode, Edge } from "../shared/model.ts";
import path from "node:path";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function parseFile(p: string, source: string): FileNode {
  const ast = ts.createSourceFile(
    p,
    source,
    ts.ScriptTarget.Latest,
    true,
    p.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const symbols: SymbolNode[] = [];
  const imports: FileNode["imports"] = [];
  function visit(n: ts.Node, parent = "") {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const bindings = n.importClause?.namedBindings;
      const names =
        bindings && ts.isNamedImports(bindings)
          ? bindings.elements.map((x) => x.name.text)
          : bindings && ts.isNamespaceImport(bindings)
            ? [bindings.name.text]
            : [];
      if (n.importClause?.name) names.push(n.importClause.name.text);
      for (const name of names.length ? names : ["*"])
        imports.push({
          name,
          specifier: n.moduleSpecifier.text,
          imported:
            bindings && ts.isNamedImports(bindings)
              ? bindings.elements.find((x) => x.name.text === name)
                  ?.propertyName?.text || name
              : n.importClause?.name?.text === name
                ? "default"
                : name,
        });
    }
    let kind = "";
    let name = "";
    if (ts.isFunctionDeclaration(n)) {
      kind = "function";
      name = n.name?.text || "default";
    } else if (ts.isClassDeclaration(n)) {
      kind = "class";
      name = n.name?.text || "default";
    } else if (ts.isInterfaceDeclaration(n)) {
      kind = "interface";
      name = n.name.text;
    } else if (ts.isTypeAliasDeclaration(n)) {
      kind = "type";
      name = n.name.text;
    } else if (ts.isMethodDeclaration(n)) {
      kind = "method";
      name = n.name.getText(ast);
    } else if (
      ts.isVariableDeclaration(n) &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) ||
        ts.isFunctionExpression(n.initializer))
    ) {
      kind = "function";
      name = n.name.getText(ast);
    }
    let qualified = parent;
    if (kind) {
      qualified = parent ? `${parent}.${name}` : name;
      const text = n.getText(ast);
      const normalized = text
        .replace(/\b[A-Za-z_$][\w$]*\b/g, "I")
        .replace(/\s+/g, "");
      const exported =
        (ts.canHaveModifiers(n) &&
          !!ts
            .getModifiers(n)
            ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) ||
        (ts.isVariableDeclaration(n) &&
          n.parent.parent.getText(ast).startsWith("export"));
      if (
        ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(
          name,
        ) &&
        exported
      )
        kind = "route";
      symbols.push({
        id: hash(`${p}:${qualified}:${n.pos}`).slice(0, 20),
        name,
        qualified,
        path: p,
        kind,
        line: ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1,
        end: ast.getLineAndCharacterOfPosition(n.end).line + 1,
        offset: n.getStart(ast),
        endOffset: n.end,
        signature: text
          .slice(0, text.indexOf("{") < 0 ? 160 : text.indexOf("{"))
          .slice(0, 220),
        fingerprint: hash(normalized),
        contentHash: hash(text),
        complexity:
          1 +
          (text.match(/\b(if|for|while|case|catch)\b|\?\?|&&|\|\|/g) || [])
            .length,
        exported: !!exported,
        confidence: 1,
        evidence: "AST declaration",
      });
    }
    ts.forEachChild(n, (c) => visit(c, qualified));
  }
  visit(ast);
  return { path: p, hash: hash(source), imports, symbols };
}
export function dependencies(
  files: FileNode[],
  sources: Map<string, string>,
): Edge[] {
  const edges: Edge[] = [];
  const byPath = new Map(files.map((f) => [f.path, f]));
  for (const file of files) {
    const bindings = new Map(file.symbols.map((s) => [s.name, s]));
    for (const symbol of file.symbols)
      edges.push({
        source: `file:${file.path}`,
        target: symbol.id,
        kind: "defines",
        confidence: 1,
        evidence: `${file.path}:${symbol.line}`,
      });
    for (const symbol of file.symbols.filter((s) => s.exported))
      edges.push({
        source: `file:${file.path}`,
        target: symbol.id,
        kind: "exports",
        confidence: 1,
        evidence: `Export modifier at ${file.path}:${symbol.line}`,
      });
    for (const imp of file.imports) {
      if (!imp.specifier.startsWith(".")) continue;
      const base = path.posix
        .normalize(
          path.posix.join(path.posix.dirname(file.path), imp.specifier),
        )
        .replace(/\.js$/, "");
      const target = [
        base,
        base + ".ts",
        base + ".tsx",
        base + "/index.ts",
        base + "/index.tsx",
      ]
        .map((p) => byPath.get(p))
        .find(Boolean);
      if (!target) continue;
      edges.push({
        source: `file:${file.path}`,
        target: `file:${target.path}`,
        kind: /\.(test|spec)\.tsx?$/.test(file.path) ? "tests" : "imports",
        confidence: 1,
        evidence: `import ${imp.name} from ${imp.specifier}`,
      });
      const dest = target.symbols.find(
        (s) =>
          (s.name === (imp.imported || imp.name) ||
            (imp.imported === "default" &&
              s.signature.startsWith("export default"))) &&
          s.exported,
      );
      if (dest) bindings.set(imp.name, dest);
      if (dest) {
        for (const sym of file.symbols) {
          const body = (sources.get(file.path) || "").slice(
            sym.offset,
            sym.endOffset,
          );
          const subtree = ts.createSourceFile(
            file.path,
            body,
            ts.ScriptTarget.Latest,
            true,
            file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
          );
          let called = false;
          const walk = (n: ts.Node) => {
            if (
              ts.isCallExpression(n) &&
              ts.isIdentifier(n.expression) &&
              n.expression.text === imp.name
            )
              called = true;
            ts.forEachChild(n, walk);
          };
          walk(subtree);
          if (called)
            edges.push({
              source: sym.id,
              target: dest.id,
              kind: "calls",
              confidence: 0.75,
              evidence: `Imported identifier call in ${file.path}:${sym.line}; shadowing not resolved`,
            });
        }
      }
    }
    const source = ts.createSourceFile(
      file.path,
      sources.get(file.path) || "",
      ts.ScriptTarget.Latest,
      true,
      file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const walk = (n: ts.Node) => {
      const line =
        source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1;
      const owner = file.symbols
        .filter((s) =>
          s.offset !== undefined && s.endOffset !== undefined
            ? s.offset <= n.getStart(source) && s.endOffset >= n.end
            : s.line <= line && s.end >= line,
        )
        .sort((a, b) => a.end - a.line - (b.end - b.line))[0];
      if (owner && ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const dest = bindings.get(n.expression.text);
        if (dest && dest.path === file.path)
          edges.push({
            source: owner.id,
            target: dest.id,
            kind: "calls",
            confidence: 0.75,
            evidence: `Local identifier call at ${file.path}:${line}; lexical shadowing may apply`,
          });
      }
      if (owner && ts.isTypeReferenceNode(n) && ts.isIdentifier(n.typeName)) {
        const dest = bindings.get(n.typeName.text);
        if (dest && dest.id !== owner.id)
          edges.push({
            source: owner.id,
            target: dest.id,
            kind: "depends on",
            confidence: 0.8,
            evidence: `Type reference at ${file.path}:${line}`,
          });
      }
      if (owner && ts.isHeritageClause(n))
        for (const t of n.types) {
          const dest = bindings.get(t.expression.getText(source));
          if (dest)
            edges.push({
              source: owner.id,
              target: dest.id,
              kind:
                n.token === ts.SyntaxKind.ExtendsKeyword
                  ? "extends"
                  : "implements",
              confidence: 0.9,
              evidence: `Heritage clause at ${file.path}:${line}`,
            });
        }
      ts.forEachChild(n, walk);
    };
    walk(source);
  }
  return edges.filter(
    (e, i, a) =>
      a.findIndex(
        (x) =>
          x.source === e.source && x.target === e.target && x.kind === e.kind,
      ) === i,
  );
}
