import { chromium } from "playwright";
import fs from "fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "shots";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1.25,
  });

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-idle.png` });
  console.log("saved 01-idle.png");

  await page.click('[data-testid="run-button"]');
  let n = 0;
  const shotInterval = setInterval(async () => {
    if (n >= 8) return;
    n++;
    try {
      await page.screenshot({ path: `${OUT}/02-run-${n}.png` });
      const toasts = await page.locator('[data-testid="toast"]').count();
      if (toasts > 0) console.log(`02-run-${n}.png — toasts visible: ${toasts}`);
      else console.log(`saved 02-run-${n}.png`);
    } catch {
      // page closed
    }
  }, 1200);

  const toastCount = await page
    .waitForSelector('[data-testid="toast"]', { timeout: 40000 })
    .then(() => page.locator('[data-testid="toast"]').count())
    .catch(() => -1);
  console.log(`run 1: toasts at denial = ${toastCount}`);

  try {
    await page.waitForSelector('[data-testid="itinerary"]', { timeout: 40000 });
  } catch {
    console.log("WARN: itinerary never appeared within 40s");
  }
  clearInterval(shotInterval);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/03-complete.png`, fullPage: true });
  console.log("saved 03-complete.png");

  // capture run id before leaving the demo page
  const runId = new URL(page.url()).searchParams.get("run");

  await page.goto(`${BASE_URL}/market`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/04-market.png` });
  console.log("saved 04-market.png");

  // --- 1536×864 @1 fit check + second run + drawer (fresh page, replayed run) ---
  const page2 = await browser.newPage({
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 1,
  });
  page2.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page2.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page2.goto(`${BASE_URL}/${runId ? `?run=${runId}` : ""}`, {
    waitUntil: "networkidle",
  });
  if (runId) {
    await page2.waitForSelector('[data-testid="itinerary"]', { timeout: 20000 }).catch(() => console.log("WARN: itinerary missing on fit page"));
    await page2.waitForTimeout(400);
    await page2.screenshot({ path: `${OUT}/05-fit-864.png` });
    console.log("saved 05-fit-864.png");
  } else {
    console.log("WARN: no run id; skipping 05");
  }

  // second run in the same session → score deltas visible
  await page2.click('[data-testid="run-button"]');
  const toastCount2 = await page2
    .waitForSelector('[data-testid="toast"]', { timeout: 40000 })
    .then(() => page2.locator('[data-testid="toast"]').count())
    .catch(() => -1);
  console.log(`run 2: toasts at denial = ${toastCount2}`);
  try {
    await page2.waitForSelector('[data-testid="itinerary"]', { timeout: 40000 });
  } catch {
    console.log("WARN: itinerary never appeared in run 2");
  }
  await page2.waitForTimeout(600);
  await page2.screenshot({ path: `${OUT}/06-second-run.png` });
  console.log("saved 06-second-run.png");

  // drawer: click first hired candidate name
  const hired = page2.locator('[data-testid="candidate-hired"] button').first();
  if (await hired.count()) {
    await hired.click();
    await page2.waitForSelector('[data-testid="agent-drawer"]', { timeout: 5000 }).catch(() => console.log("WARN: drawer did not open"));
    await page2.waitForTimeout(800);
    await page2.screenshot({ path: `${OUT}/07-drawer.png` });
    console.log("saved 07-drawer.png");
  } else {
    console.log("WARN: no hired candidate found; skipping 07");
  }

  await page2.goto(`${BASE_URL}/market`, { waitUntil: "networkidle" });
  await page2.waitForTimeout(400);
  await page2.screenshot({ path: `${OUT}/08-market.png` });
  console.log("saved 08-market.png");

  if (consoleErrors.length) {
    console.log(`CONSOLE ERRORS (${consoleErrors.length}):`);
    for (const e of consoleErrors.slice(0, 10)) console.log("  " + e);
  } else {
    console.log("no console errors");
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
