import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "tests/journey-evidence";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  requests = [],
  report = {};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => {
    if (!r.failure().errorText.includes("ABORTED"))
      errors.push(r.failure().errorText);
  });
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:8123") &&
      !r.url().startsWith("data:")
    )
      requests.push(r.url());
  });
  await page.addInitScript(() => {
    const raf = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raf(() => cb(performance.now() * 10));
  });
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  for (const [id, choice] of [
    ["monsoon-pashan", "detour"],
    ["monsoon-pashan", "main"],
    ["baner-evening", "main"],
    ["evening-chai-run", "main"],
  ]) {
    const name = `${id}-${choice}`;
    if (
      await page.evaluate(
        () => window.wanderlane.state.experience.status === "completed",
      )
    )
      await page.click("#tripCancel");
    await page.selectOption("#discoveryDrive", id);
    if (id === "monsoon-pashan")
      await page.selectOption("#journeyRoute", "detour");
    else if (id !== "baner-evening")
      await page.selectOption("#journeyRoute", "main");
    await page.click("#tripStart");
    await page.waitForFunction(() => {
      const s = window.wanderlane.state;
      return (
        s.experience.status === "active" && !s.city.pending && !s.city.queued
      );
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${dir}/${name}-start.png` });
    assert.ok(
      await page
        .locator("#tripGuidance")
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize) >= 14),
    );
    assert.ok(await page.locator("#tripObjective").isHidden());
    const cueBefore = await page.evaluate(
      () => window.wanderlane.state.arrivalCueCount,
    );
    await page.click("#autoBtn");
    const started = Date.now();
    let completed = false,
      nextLog = 0,
      forkShot = false,
      changed = false,
      arrivalGap = Infinity,
      settlingSeen = false;
    while (Date.now() - started < 480000) {
      await page.waitForTimeout(arrivalGap < 80 ? 60 : 1000);
      const s = await page.evaluate(() => window.wanderlane.state);
      arrivalGap = s.experience.arrival.distance;
      if (!settlingSeen && s.experience.arrival.stage === "settling") {
        settlingSeen = true;
        assert.ok(await page.locator("#tripArrival").isVisible());
        await page.screenshot({ path: `${dir}/${name}-parking.png` });
      }
      if (
        id === "monsoon-pashan" &&
        choice === "main" &&
        !changed &&
        s.roadDistance > 4080 &&
        s.roadDistance < 4240
      ) {
        const earned = s.experience.progress * s.experience.distance;
        await page.selectOption("#journeyRoute", "main");
        const after = await page.evaluate(
          () => window.wanderlane.state.experience,
        );
        const afterEarned = after.distance * after.progress;
        assert.ok(
          afterEarned >= earned - 0.1,
          `route choice lost progress: ${earned} -> ${afterEarned}`,
        );
        assert.ok(
          afterEarned - earned <=
            Math.max(10, (after.elapsed - s.experience.elapsed) * 20 + 2),
          "route change awarded unearned distance",
        );
        changed = true;
      }
      if (Date.now() - started > nextLog) {
        console.log(
          name,
          Math.round(s.roadDistance),
          s.experience.objectiveIndex,
          Math.round(s.speed * 3.6),
          Math.round(s.experience.arrival.distance),
        );
        nextLog += 20000;
      }
      if (
        !forkShot &&
        id === "monsoon-pashan" &&
        s.roadDistance > 4255 &&
        s.roadDistance < 4650
      ) {
        await page.screenshot({ path: `${dir}/${name}-fork.png` });
        forkShot = true;
      }
      if (s.experience.status === "completed") {
        report[name] = s;
        completed = true;
        break;
      }
    }
    if (!completed) {
      await page.screenshot({ path: `${dir}/${name}-failure.png` });
      throw Error(
        `Journey stalled: ${JSON.stringify(await page.evaluate(() => window.wanderlane.state))}`,
      );
    }
    assert.equal(report[name].auto, false);
    assert.ok(Math.abs(report[name].speed) < 0.5);
    assert.ok(report[name].experience.arrival.dwell >= 2);
    assert.equal(report[name].experience.routeChoice, choice);
    if (choice === "main" && id === "monsoon-pashan")
      assert.ok(changed, "live fork choice was not exercised");
    assert.equal(report[name].city.error, null);
    assert.ok(settlingSeen, "parking countdown was not exercised");
    assert.equal(
      report[name].arrivalCueCount,
      cueBefore + 1,
      "arrival sound must play exactly once",
    );
    await page.screenshot({ path: `${dir}/${name}-arrival.png` });
    assert.ok(await page.locator("#discoveryChoice").isHidden());
    const beforePhoto = await page.evaluate(() => window.wanderlane.state);
    await page.click("#postcardBtn");
    assert.equal(
      (await page.evaluate(() => window.wanderlane.state)).camera,
      beforePhoto.camera,
    );
    assert.ok(
      await page
        .locator("#postcardImage")
        .evaluate((e) => e.naturalWidth === 1200 && e.naturalHeight === 880),
    );
    await page.screenshot({ path: `${dir}/${name}-postcard.png` });
    const card = await page.locator("#postcardImage").getAttribute("src");
    await writeFile(
      `${dir}/${name}-card.png`,
      Buffer.from(card.split(",")[1], "base64"),
    );
    assert.ok(
      (await page.locator("#postcardDownload").getAttribute("href")).startsWith(
        "data:image/png",
      ),
    );
    await page.locator("#postcardDialog button").click();
  }
  const before = await page.evaluate(() => window.wanderlane.state.journal);
  await page.reload();
  await page.waitForFunction(() => window.wanderlane);
  assert.deepEqual(
    await page.evaluate(() => window.wanderlane.state.journal),
    before,
  );
  await page.click("#startBtn");
  report.modeSwitches = [];
  for (let i = 0; i < 3; i++) {
    for (const mode of ["endless", "pune"]) {
      await page.click("#settingsBtn");
      await page.selectOption("#driveMode", mode);
      await page.waitForFunction(
        (m) => window.wanderlane.state.driveMode === m,
        mode,
      );
      await page.click("#resumeBtn");
      await page.waitForTimeout(1000);
      const s = await page.evaluate(() => window.wanderlane.state);
      assert.equal(s.driveMode, mode);
      if (mode === "pune") {
        assert.equal(s.city.error, null);
        assert.equal(s.experience.routeChoice, "main");
      }
      report.modeSwitches.push({
        mode,
        geometries: s.geometries,
        textures: s.textures,
      });
    }
  }
  const counts = report.modeSwitches.filter((s) => s.mode === "pune");
  assert.ok(
    Math.max(...counts.map((s) => s.textures)) -
      Math.min(...counts.map((s) => s.textures)) <=
      2,
  );
  assert.ok(
    Math.max(...counts.map((s) => s.geometries)) -
      Math.min(...counts.map((s) => s.geometries)) <=
      10,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  await writeFile(
    `${dir}/journeys.json`,
    JSON.stringify({ report, errors, requests }, null, 2),
  );
  console.log(
    "Main, detour, Baner and Evening Chai Run parking, arrival sound, framed postcards and journal reload passed",
  );
} finally {
  await browser.close();
}
