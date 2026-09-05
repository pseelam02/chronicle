import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Page } from "@playwright/test";
import { launch } from "./runtime.ts";
import { fixture } from "./fixture.ts";
import { mkdir } from "node:fs/promises";
export async function exercise(page: Page, url: string, demo: boolean) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page
    .getByRole("heading", { name: "Every codebase has a story." })
    .waitFor();
  await page.getByLabel("Search symbols").fill("no-such-symbol");
  await page.getByRole("heading", { name: "No symbols in view" }).waitFor();
  await page.getByLabel("Search symbols").fill("");
  await page.getByLabel("Filter symbol kind").selectOption("function");
  await page.getByLabel("Filter symbol kind").selectOption("all");
  await page.locator(".node").first().click();
  await page
    .getByRole("heading", { name: "Why does this exist?", exact: true })
    .waitFor();
  assert.ok((await page.locator(".evidence").count()) > 0);
  await page.getByRole("button", { name: "Close symbol inspector" }).click();
  await page.getByLabel("History checkpoint").fill("0");
  await page.getByLabel("History checkpoint").press("ArrowRight");
  assert.equal(await page.getByLabel("History checkpoint").inputValue(), "1");
  await page.getByRole("button", { name: "Play timeline" }).click();
  await page.waitForFunction(
    () =>
      Number(
        (document.querySelector("input[type=range]") as HTMLInputElement).value,
      ) > 1,
  );
  await page.getByRole("button", { name: "Pause timeline" }).click();
  await page.getByRole("button", { name: "⇄ Compare", exact: true }).click();
  await page.getByRole("heading", { name: "See what changed." }).waitFor();
  assert.ok((await page.locator(".symbol-row").count()) > 0);
  if (!demo) {
    await page.getByLabel("Compare from").selectOption({ index: 3 });
    await page
      .getByLabel("Compare to")
      .selectOption({
        label: "Working tree · Working tree including untracked Ty",
      })
      .catch(async () => {
        const v = await page
          .getByLabel("Compare to")
          .locator("option")
          .allTextContents();
        await page
          .getByLabel("Compare to")
          .selectOption({ index: v.length - 1 });
      });
  }
  await page.getByRole("button", { name: "View local Git diff ↗" }).click();
  await page.locator(".diff").waitFor();
  await page
    .getByRole("button", { name: "◎ Blast radius", exact: true })
    .click();
  await page.getByRole("heading", { name: "Follow the ripple." }).waitFor();
  await page
    .getByRole("button", { name: "▦ Architecture", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("heading", { name: "Every codebase has a story." })
    .waitFor();
  assert.equal(await page.evaluate(() => location.hash), "");
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByLabel("Search symbols").fill("");
  await page.locator(".node").first().click();
  await page
    .getByRole("heading", { name: "Why does this exist?", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Close symbol inspector" }).click();
}
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
