import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.stack));
page.on("console", (m) => {
  if (["warning", "error"].includes(m.type())) console.log(m.type(), m.text());
});
page.on("requestfailed", (r) => console.log("FAILED:", r.url(), r.failure()));
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForTimeout(2500);
  console.log(
    "Loaded",
    await page.evaluate(() => ({
      ready: !!window.wanderlane,
      button: document.getElementById("startBtn")?.textContent,
    })),
  );
} finally {
  await browser.close();
}
