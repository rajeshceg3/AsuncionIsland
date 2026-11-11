import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
const out = process.env.OUT || "verification/gate";
fs.mkdirSync(out, { recursive: true });
const url = process.env.BASE_URL || "http://127.0.0.1:8794";
let server;
if (!process.env.BASE_URL) {
  server = spawn("python3", ["-m", "http.server", "8794"], { stdio: "ignore" });
  for (let i = 0; i < 30; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
}
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (const width of JSON.parse(process.env.WIDTHS || "[390,1440]")) {
    if (!process.env.SKIP_PINNED) {
      const p = await browser.newPage(); const errors = [];
      p.on("pageerror", (e) => errors.push(String(e)));
      await p.setViewport({ width, height: 844 });
      await p.evaluateOnNewDocument(() => localStorage.setItem("asuncion-chrome-pin", "1"));
      await p.goto(url); await p.waitForSelector("#veil.gone", { timeout: 15000 }); await sleep(1500);
      for (let i = 0; i < 4; i++) {
        await p.click(`[data-scene="${i}"]`); await sleep(1500);
        const s = await p.evaluate(() => ({
          current: document.querySelector('.dot[aria-current="true"]')?.dataset.scene,
          overflow: document.documentElement.scrollWidth > innerWidth,
          targets: [...document.querySelectorAll("button")].filter((b) => getComputedStyle(b).visibility !== "hidden").map((b) => { const r = b.getBoundingClientRect(); return [r.width, r.height, b.getAttribute("aria-label")]; }),
          labelFont: [...document.querySelectorAll(".dot span")].map((e) => parseFloat(getComputedStyle(e).fontSize)),
        }));
        assert.equal(s.current, String(i)); assert.equal(s.overflow, false);
        assert.ok(s.targets.every((t) => t[0] >= 44 && t[1] >= 44 && t[2]), JSON.stringify(s.targets));
        assert.ok(s.labelFont.every((f) => f >= 14));
        await p.screenshot({ path: `${out}/${width}-pinned-${i}.png` });
      }
      await p.click("#next-face"); await sleep(400);
      assert.equal(await p.$eval('.dot[aria-current="true"]', (e) => e.dataset.scene), "0");
      assert.deepEqual(errors, []); await p.close();
    }
    {
      const p = await browser.newPage(); const errors = [];
      p.on("pageerror", (e) => errors.push(String(e)));
      await p.setViewport({ width, height: 844 });
      await p.evaluateOnNewDocument(() => { localStorage.removeItem("asuncion-chrome-pin"); addEventListener("DOMContentLoaded", () => { window.__seenOn = document.body.classList.contains("chrome-on"); new MutationObserver(() => { if (document.body.classList.contains("chrome-on")) window.__seenOn = true; }).observe(document.body, { attributes: true }); }); });
      await p.goto(url); await p.waitForSelector("#veil.gone", { timeout: 15000 });
      const on = () => p.$eval("body", (b) => b.classList.contains("chrome-on"));
      const vis = (s) => p.$eval(s, (e) => getComputedStyle(e).visibility);
      assert.equal(await p.evaluate(() => window.__seenOn), true, "greets");
      await p.waitForFunction(() => !document.body.classList.contains("chrome-on"), { timeout: 12000 }); await sleep(500);
      assert.equal(await vis("#dock"), "hidden"); assert.equal(await vis("#chrome-hint"), "visible");
      assert.equal(await vis("#caption"), "visible", "caption stays");
      await p.screenshot({ path: `${out}/${width}-quiet.png` });
      await p.click("#chrome-hint"); assert.equal(await on(), true); await sleep(400);
      await p.screenshot({ path: `${out}/${width}-woken.png` });
      await p.click("#pin-chrome"); await sleep(3500); assert.equal(await on(), true, "pinned holds");
      assert.equal(await p.evaluate(() => localStorage.getItem("asuncion-chrome-pin")), "1");
      await p.click("#pin-chrome"); await p.mouse.move(width / 2, 400); await p.keyboard.press("Escape"); await sleep(400);
      assert.equal(await on(), false, "escape retires");
      if (width > 760) {
        await p.mouse.move(width / 2, 830); assert.equal(await on(), true, "edge wakes");
        await p.mouse.move(width / 2, 400);
        await p.waitForFunction(() => !document.body.classList.contains("chrome-on"), { timeout: 9000 });
      }
      assert.deepEqual(errors, []); await p.close();
    }
    console.log("passed", width);
  }
} finally { await browser.close(); server?.kill(); }
