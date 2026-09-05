import { build } from "esbuild";
import { mkdir, copyFile, writeFile, chmod } from "node:fs/promises";
import { tsImport } from "tsx/esm/api";
await mkdir("dist/web", { recursive: true });
await build({
  entryPoints: ["packages/cli/cli.ts", "packages/cli/worker.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  target: "node22",
});
await build({
  entryPoints: ["packages/web/app.tsx"],
  outdir: "dist/web",
  bundle: true,
  minify: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
});
await copyFile("packages/web/index.html", "dist/web/index.html");
const { demo } = await tsImport(
  "../packages/analyzer/demo.ts",
  import.meta.url,
);
await writeFile("dist/demo.json", JSON.stringify(demo()));
await chmod("dist/cli.js", 0o755);
