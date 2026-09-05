import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, rm, readFile, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { fixture } from "../tests/fixture.ts";
import { launch } from "../tests/runtime.ts";
import { exercise } from "../tests/browser-flows.ts";
const exec = promisify(execFile);
await mkdir("artifacts", { recursive: true });
const packed = await exec(
  "npm",
  ["pack", "--json", "--pack-destination", "artifacts"],
  { maxBuffer: 5_000_000 },
);
const info = JSON.parse(packed.stdout)[0];
const tarball = path.resolve("artifacts", info.filename);
assert.ok(
  info.files.every(
    (f: { path: string }) =>
      !/(^|\/)(\.env|node_modules|tests|artifacts|\.git|packages)(\/|\.|$)/.test(
        f.path,
      ),
  ),
);
assert.ok(
  info.files.some((f: { path: string }) => f.path === "dist/web/app.js"),
);
const dir = await mkdtemp(path.join(os.tmpdir(), "chronicle-install-"));
const f = await fixture();
let browser;
try {
  await exec(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
    {
      cwd: dir,
      maxBuffer: 2_000_000,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !/^npm_config_/i.test(key),
          ),
        ),
        NPM_CONFIG_USERCONFIG: path.join(dir, "absent-user-npmrc"),
        NPM_CONFIG_GLOBALCONFIG: path.join(dir, "absent-global-npmrc"),
      },
    },
  );
  const exe = path.join(
    dir,
    "node_modules",
    "@pseelam",
    "chronicle",
    "dist",
    "cli.js",
  );
  assert.match(
    (await exec(process.execPath, [exe, "--version"], { cwd: dir })).stdout,
    /0.1.0/,
  );
  assert.match(
    (await exec(process.execPath, [exe, "--help"], { cwd: dir })).stdout,
    /--demo/,
  );
  const js = await readFile(
    path.join(
      dir,
      "node_modules",
      "@pseelam",
      "chronicle",
      "dist",
      "web",
      "app.js",
    ),
    "utf8",
  );
  assert.ok(!js.includes("sk-proj-"));
  assert.ok(!js.includes(process.cwd()));
  browser = await chromium.launch();
  for (const isDemo of [true, false]) {
    const s = await launch(
      isDemo ? ["--demo", "--no-ai"] : [f.root, "--no-ai", "--force"],
      exe,
    );
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    });
    try {
      await exercise(page, s.url, isDemo);
      await page.screenshot({
        path: `artifacts/packed-${isDemo ? "demo" : "fixture"}-mobile.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1050 });
      await page.getByRole("button", { name: "Fit view" }).click();
      await page.screenshot({
        path: `artifacts/packed-${isDemo ? "demo" : "fixture"}-desktop.png`,
        fullPage: true,
      });
    } finally {
      await page.close();
      await s.stop();
    }
  }
  console.log(
    `PACKED INSTALL PASS: ${info.filename}, ${(await stat(tarball)).size} bytes; clean install, help, version, demo, private fixture, browser flows, mobile and shutdown verified.`,
  );
} finally {
  await browser?.close();
  await f.cleanup();
  await rm(dir, { recursive: true, force: true });
}
