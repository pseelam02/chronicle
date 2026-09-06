import { test } from "node:test";
import { chromium } from "@playwright/test";
import { launch } from "./runtime.ts";
import { fixture } from "./fixture.ts";
import { mkdir } from "node:fs/promises";
import { exercise } from "./browser-flows.ts";
import assert from "node:assert/strict";
import { demo } from "../packages/analyzer/demo.ts";

test(
  "browser demo and private local fixture end-to-end",
  { timeout: 90000 },
  async () => {
    const browser = await chromium.launch();
    const f = await fixture();
    await mkdir("artifacts", { recursive: true });
    try {
      for (const demo of [true, false]) {
        const s = await launch(
          demo ? ["--demo", "--no-ai"] : [f.root, "--force", "--no-ai"],
        );
        const page = await browser.newPage({
          viewport: { width: 1440, height: 1050 },
        });
        try {
          await exercise(page, s.url, demo);
          await page.screenshot({
            path: `artifacts/${demo ? "demo" : "fixture"}-mobile.png`,
            fullPage: true,
          });
          await page.setViewportSize({ width: 1440, height: 1050 });
          await page.getByRole("button", { name: "Fit view" }).click();
          await page.screenshot({
            path: `artifacts/${demo ? "demo" : "fixture"}-desktop.png`,
            fullPage: true,
          });
        } finally {
          await page.close();
          await s.stop();
        }
      }
    } finally {
      await browser.close();
      await f.cleanup();
    }
  },
);
test(
  "browser AI consent, bounded large graphs, error and reconnection states",
  { timeout: 60000 },
  async () => {
    const browser = await chromium.launch();
    const s = await launch(["--demo", "--no-ai"]);
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    try {
      let sent = 0;
      await page.route("**/api/status", async (route) => {
        const response = await route.fetch();
        const status = await response.json();
        await route.fulfill({ json: { ...status, ai: true } });
      });
      await page.route("**/api/synthesize", async (route) => {
        sent++;
        assert.equal(route.request().postDataJSON().consent, true);
        await route.fulfill({
          json: {
            claims: [{ text: "Synthetic cited summary", citations: ["E1"] }],
          },
        });
      });
      await page.goto(s.url);
      await page.locator(".node").first().click();
      await page
        .getByRole("button", { name: "Preview evidence to send" })
        .click();
      await page.locator(".ai-preview").waitFor();
      assert.equal(sent, 0);
      await page
        .getByRole("button", { name: "I consent — send this evidence" })
        .click();
      await page
        .getByText("Synthetic cited summary [E1]", { exact: true })
        .waitFor();
      assert.equal(sent, 1);
      await page
        .getByRole("button", { name: "Close symbol inspector" })
        .click();
      const large = demo();
      const c = large.checkpoints.at(-1)!;
      const seed = c.files[0].symbols[0];
      c.files[0].symbols = Array.from({ length: 120 }, (_, i) => ({
        ...seed,
        id: "large" + i,
        name: "function" + i,
      }));
      await page.route("**/api/analysis", (route) =>
        route.fulfill({ json: large }),
      );
      await page.reload();
      await page.getByText(/Showing 100 of/).waitFor();
      assert.equal(await page.locator(".node").count(), 100);
      await page.getByLabel("Search symbols").fill("function119");
      assert.equal(await page.locator(".node").count(), 1);
      await s.stop();
      await page.getByText("○ Reconnecting", { exact: true }).waitFor();
      await page.screenshot({ path: "artifacts/reconnecting.png" });
    } finally {
      await page.close();
      await browser.close();
      await s.stop();
    }
    const f = await fixture();
    const failed = await launch([f.root, "--ref", "absent-ref", "--no-ai"]);
    const b = await chromium.launch();
    try {
      const p = await b.newPage();
      await p.goto(failed.url);
      await p
        .getByRole("heading", { name: "Analysis needs attention" })
        .waitFor();
      await p.getByText(/Analysis failed/).waitFor();
      await p.screenshot({ path: "artifacts/failed-analysis.png" });
    } finally {
      await b.close();
      await failed.stop();
      await f.cleanup();
    }
  },
);
