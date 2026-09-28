import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const phase = process.argv[2] || "after";
const dir = `tests/real-pune-${phase}`;
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:8123");
await page.waitForFunction(() => window.wanderlane);
await page.click("#startBtn");
await page.click("#tripStart");
await page.waitForFunction(
  () => window.wanderlane.state.experience.status === "active",
);
// Identical normal UI start, stationary camera and weather in both captures.
const reports = [];
for (const mood of ["Day", "Sunset", "Night", "Monsoon"]) {
  const time = mood === "Monsoon" ? "Day" : mood;
  while ((await page.evaluate(() => window.wanderlane.state.time)) !== time)
    await page.click("#timeBtn");
  await page.click("#settingsBtn");
  await page.selectOption(
    "#puneSeason",
    mood === "Monsoon" ? "Monsoon" : "Summer",
  );
  await page.click("#resumeBtn");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/${mood.toLowerCase()}.png` });
  reports.push(await page.evaluate(() => window.wanderlane.state));
}
await writeFile(
  `${dir}/report.json`,
  JSON.stringify({ reports, errors }, null, 2),
);
await browser.close();
