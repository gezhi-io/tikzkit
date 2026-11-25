// Run with local Google Chrome and Playwright: node --test test/web-workbench-races.browser.js
// PLAYWRIGHT_MODULE can point to an existing playwright/index.mjs; WORKBENCH_QA_DIR saves evidence.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { pathToFileURL } from "node:url";
import { createWorkbenchServer } from "../web/server.js";

const scratch = "tikzkit-scratch";
const other = "latex-examples-2048";
const fixtureApi = `/api/fixtures/${other}`;
const draftKey = (id) => `tikzkit.workbench.draft.v1:${id}`;
const line = (x) => String.raw`\begin{tikzpicture}\draw (0,0) -- (${x},1);\end{tikzpicture}`;
const evidenceDir = process.env.WORKBENCH_QA_DIR;
const report = { scenarios: {} };
let server, origin, browser;

before(async () => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href : "playwright");
  if (evidenceDir) await mkdir(evidenceDir, { recursive: true });
  server = await createWorkbenchServer();
  await new Promise((ok, fail) => server.once("error", fail).listen(0, "127.0.0.1", ok));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: "chrome" });
  report.browser = `Google Chrome ${browser.version()}`;
});

after(async () => {
  await browser?.close();
  if (server?.listening) await new Promise((ok) => server.close(ok));
  if (evidenceDir && report.browser) {
    await writeFile(path.join(evidenceDir, "evidence.json"), JSON.stringify(report, null, 2) + "\n");
  }
});

async function snapshot(page) {
  return page.evaluate(() => {
    const el = (id) => document.getElementById(id);
    return {
      hash: location.hash, selected: el("fixture-select").value, title: el("fixture-title").textContent,
      source: document.querySelector(".CodeMirror").CodeMirror.getValue(),
      path: el("tikzkit-result").querySelector('path[stroke="black"]')?.getAttribute("d") ?? null,
      hasSvg: Boolean(el("tikzkit-result").querySelector("svg")),
      stale: el("tikzkit-result").classList.contains("is-stale"),
      draft: el("draft-status").textContent, render: el("render-status").textContent,
      audit: el("semantic-summary").textContent, busy: el("render-button").disabled,
      copyDisabled: el("copy-svg-button").disabled, downloadDisabled: el("download-svg-button").disabled
    };
  });
}

async function ready(page, id) {
  await page.waitForFunction((id) => document.querySelector("#fixture-summary").textContent.startsWith(id + " ")
    && !document.querySelector("#render-button").disabled && document.querySelector("#tikzkit-result svg")
    && document.querySelector("#render-status").textContent.includes("diagnostics"), id);
}

async function edit(page, text) {
  await page.locator(".CodeMirror").evaluate(({ CodeMirror: editor }) => {
    editor.focus();
    editor.execCommand("selectAll");
  });
  await page.keyboard.insertText(text);
}

const render = (page) => page.locator("#render-button").click();
const shortcut = (page) => page.keyboard.press("Control+Enter");
const setHash = (page, id) => page.evaluate((id) => { location.hash = id; }, id);

// Pause delivery of a fully read, real HTTP body. Releasing it drains the app's
// promise continuations before the next task, without a guessed network delay.
async function holdBody(page, pathname, source) {
  const latch = await page.evaluateHandle(({ pathname, source }) => {
    let release;
    const gate = new Promise((ok) => { release = ok; });
    const latch = { reached: false, release };
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await fetch(input, init);
      if (new URL(response.url).pathname === pathname && (!source || JSON.parse(init.body).source === source)) {
        const method = pathname.endsWith("/source") ? "text" : "json";
        const read = response[method].bind(response);
        response[method] = async () => {
          const body = await read();
          latch.reached = true;
          await gate;
          return body;
        };
      }
      return response;
    };
    return latch;
  }, { pathname, source });
  return {
    wait: () => page.waitForFunction((latch) => latch.reached, latch),
    release: () => latch.evaluate((latch) => {
      latch.release();
      return new Promise((ok) => setTimeout(ok, 0));
    })
  };
}

function scenario(name, run, initialId = scratch) {
  test(name, async () => {
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    page.setDefaultTimeout(8000);
    const row = report.scenarios[name] = { steps: {}, requests: [], errors: [] };
    page.on("pageerror", (err) => row.errors.push(err.message));
    page.on("request", (req) => {
      const pathname = new URL(req.url()).pathname;
      if (pathname.startsWith("/api/")) row.requests.push({ pathname, source: req.postDataJSON()?.source });
    });
    const mark = async (step, screenshot = false) => {
      const state = row.steps[step] = await snapshot(page);
      if (evidenceDir && screenshot) await page.screenshot({ path: path.join(evidenceDir, step + ".png") });
      return state;
    };
    const count = (pathname, source) => row.requests.filter((req) => req.pathname === pathname
      && (source === undefined || req.source === source)).length;
    try {
      await page.goto(`${origin}/#${initialId}`);
      await ready(page, initialId);
      await run(page, mark, count);
      assert.deepEqual(row.errors, []);
      row.passed = true;
    } catch (err) {
      row.passed = false;
      row.failure = err.message;
      await mark("at-failure").catch(() => {});
      throw err;
    } finally {
      await page.close();
    }
  });
}

scenario("edit during audit cannot publish or export an obsolete preview", async (page, mark) => {
  const audit = await holdBody(page, "/api/audit", line(2));
  await edit(page, line(2));
  await render(page);
  await audit.wait();
  await edit(page, line(4));
  const before = await mark("edited-while-waiting");
  await audit.release();
  await page.waitForFunction(() => !document.querySelector("#render-button").disabled);
  await page.locator("#grid-toggle").click();
  const after = await mark("obsolete-audit-returned", true);
  assert.equal(before.stale, true);
  assert.equal(after.source, line(4));
  assert.equal(after.stale, true, "late audit cleared the stale preview marker");
  assert.equal(after.path, before.path, "obsolete render replaced the last accepted preview");
  assert.match(after.draft, /render/i);
  assert.ok(before.copyDisabled && before.downloadDisabled && after.copyDisabled && after.downloadDisabled);
  assert.match(after.audit, /render to audit draft/);
  await render(page);
  await ready(page, scratch);
  const fresh = await mark("rendered-current-draft");
  assert.equal(fresh.path, "M 0 0 L 400 -100");
  assert.ok(!fresh.stale && !fresh.copyDisabled && !fresh.downloadDisabled);
  assert.match(fresh.audit, /current draft/);
  const downloaded = page.waitForEvent("download");
  await page.locator("#download-svg-button").click();
  const svg = await downloaded;
  assert.equal(svg.suggestedFilename(), scratch + ".svg");
  assert.match(await readFile(await svg.path(), "utf8"), /d="M 0 0 L 400 -100"/);
});

scenario("repeat render deduplicates identical work and only the newest request can finish", async (page, mark, count) => {
  const gates = [];
  for (const x of [2, 3, 4]) {
    const gate = await holdBody(page, "/api/audit", line(x));
    await edit(page, line(x));
    await shortcut(page);
    await gate.wait();
    gates.push(gate);
    if (x === 2) await shortcut(page);
  }
  await gates[1].release();
  const waiting = await mark("middle-render-returned");
  await gates[2].release();
  await ready(page, scratch);
  const newest = await mark("newest-render-returned");
  await gates[0].release();
  const late = await mark("oldest-render-returned");
  assert.equal(waiting.busy, true, "an obsolete finally enabled Render");
  assert.equal(count("/api/audit", line(2)), 1);
  assert.equal(newest.path, "M 0 0 L 400 -100");
  assert.deepEqual(late, newest);
});

scenario("switching cases invalidates old renders and prevents exporting the previous case", async (page, mark, count) => {
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [draftKey(other), line(6)]);
  const old = await holdBody(page, "/api/audit", line(2));
  const loading = await holdBody(page, fixtureApi + "/source");
  const next = await holdBody(page, "/api/audit", line(6));
  await edit(page, line(2));
  await render(page);
  await old.wait();
  await page.locator("#fixture-select").selectOption(other);
  await loading.wait();
  await edit(page, line(8));
  await shortcut(page);
  const fetching = await mark("fetching-another-case");
  await loading.release();
  await next.wait();
  const switched = await mark("new-case-before-first-preview");
  await next.release();
  await ready(page, other);
  const current = await mark("new-case-rendered");
  await old.release();
  assert.deepEqual(await mark("old-case-render-returned"), current);
  assert.equal(current.path, "M 0 0 L 600 -100");
  assert.ok(fetching.copyDisabled && fetching.downloadDisabled);
  assert.ok(switched.copyDisabled && switched.downloadDisabled);
  assert.ok(!switched.hasSvg || switched.stale);
  assert.equal(count("/api/audit", line(8)), 0, "render shortcut submitted the departing case");
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), draftKey(scratch)), line(8));
});

scenario("live hash, history and selector restore per-case drafts without duplicate loads", async (page, mark, count) => {
  assert.equal((await mark("initial-deep-link")).selected, scratch);
  await edit(page, line(5));
  await page.locator("#fixture-filter").fill(scratch);
  await setHash(page, other);
  await ready(page, other);
  assert.equal((await mark("external-hash")).selected, other, "filtered-out hash target missing from selector");
  await edit(page, line(7));
  await page.goBack();
  await ready(page, scratch);
  const back = await mark("hash-back", true);
  assert.equal(back.hash, "#" + scratch);
  assert.equal(back.source, line(5));
  await page.goForward();
  await ready(page, other);
  const forward = await mark("hash-forward");
  assert.equal(forward.selected, other);
  assert.equal(forward.source, line(7));
  await page.locator("#fixture-select").selectOption(scratch);
  await ready(page, scratch);
  await page.goBack();
  await ready(page, other);
  assert.equal((await mark("back-after-selector")).source, line(7));
  assert.equal(count("/api/fixtures"), 1, "same-document navigation reloaded the workbench");
  assert.equal(count(fixtureApi + "/source"), 3);
  assert.equal(count(fixtureApi + "/audit"), 3);
  assert.equal(count("/api/audit", line(5)), 2);
  assert.equal(count("/api/audit", line(7)), 2);
});

scenario("back while a hash target is loading cancels it even when the old case is still active", async (page, mark, count) => {
  await edit(page, line(9));
  const loading = await holdBody(page, fixtureApi + "/source");
  await setHash(page, other);
  await loading.wait();
  await page.goBack();
  await ready(page, scratch);
  await loading.release();
  const back = await mark("late-fixture-source-returned");
  assert.equal(back.hash, "#" + scratch);
  assert.equal(back.selected, scratch);
  assert.equal(back.source, line(9));
  assert.equal(count(fixtureApi + "/source"), 1);
  assert.equal(count(fixtureApi + "/audit"), 0, "a cancelled load fetched additional fixture data");
});

const deepLink = "latex-examples-center";
scenario("cold deep link and two queued hash changes load only the final target", async (page, mark, count) => {
  assert.equal((await mark("cold-non-default-fixture")).selected, deepLink);
  await edit(page, line(10));
  const loading = await holdBody(page, fixtureApi + "/source");
  await page.evaluate(([via, to]) => {
    location.hash = via;
    location.hash = to;
  }, [scratch, other]);
  await loading.wait();
  await loading.release();
  await ready(page, other);
  assert.equal((await mark("after-queued-hash-changes")).selected, other);
  assert.equal(count(fixtureApi + "/source"), 1);
  assert.equal(count(fixtureApi + "/audit"), 1);
  assert.equal(count("/api/audit"), 0, "rendered the transient scratch hash");
  await page.goBack();
  await ready(page, scratch);
  await page.goBack();
  await ready(page, deepLink);
  const restored = await mark("deep-link-draft-restored");
  assert.equal(restored.source, line(10));
  assert.equal(restored.path, "M 0 0 L 1000 -100");
  assert.equal(count("/api/fixtures"), 1);
}, deepLink);
