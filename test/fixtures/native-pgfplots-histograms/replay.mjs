import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const [action, dir, arg, publicRoot] = process.argv.slice(2);
assert.ok(dir && ["inputs", "serve", "routes"].includes(action),
  "Usage: node replay.mjs inputs <new-catalog> | serve <captured-stage> [port] | routes <captured-stage> <playwright.mjs> [public-catalog]");
const root = path.resolve(dir);
const json = async file => JSON.parse(await readFile(file, "utf8"));
const save = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + "\n");
const load = file => import(pathToFileURL(path.resolve(file)).href);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

if (action === "inputs") {
  // The native generator resolves resource.source under its catalog and rewrites
  // resource.name in TeX. Use links named exactly as printed in the original.
  const manifest = await json(path.join(here, "manifest.json"));
  await mkdir(root, {recursive: true});
  async function link(source, name) {
    const target = path.resolve(here, source), dst = path.join(root, name);
    await mkdir(path.dirname(dst), {recursive: true});
    try { await symlink(path.relative(path.dirname(dst), target), dst); }
    catch (e) { if (e.code !== "EEXIST") throw e; }
    assert.equal(await realpath(dst), await realpath(target));
    return name;
  }
  for (const row of manifest.cases) {
    row.source = await link(row.source, row.id + ".tex");
    for (const r of row.resources || []) r.source = await link(r.source, r.name);
  }
  await save(path.join(root, "manifest.json"), manifest);
  await link("milestone-1.json", "milestone-1.json");
} else {
  const capture = await json(path.join(root, "capture.json"));
  const fixtureRoot = publicRoot ? path.resolve(publicRoot) : capture.fixtureRoot;
  const equivalent = process.env.TIKZKIT_QA_COMPARE_TREE;
  const tree = equivalent ? path.resolve(equivalent) : capture.tree;
  const fingerprint = async () => (await (await load(path.join(tree,"scripts/render-example-fixtures.js"))).fingerprintRenderEnvironment()).rendererSha256;
  const renderer = await fingerprint();
  if (!equivalent) assert.equal(renderer,capture.environment.rendererSha256);
  const {createWorkbenchServer} = await load(path.join(tree, "web/server.js"));
  const server = await createWorkbenchServer({fixtureRoot, outputRoot:publicRoot ? undefined : root});
  await new Promise((ok, fail) => server.once("error", fail).listen(action === "serve" ? Number(arg || 0) : 0, "127.0.0.1", ok));
  const origin = "http://127.0.0.1:" + server.address().port;
  if (action === "serve") console.log(origin + "/#hist-manual-cumulative-x");
  else {
    let browser;
    try {
      browser = await (await load(arg)).chromium.launch({channel:"chrome", headless:true});
      const records = [];
      for (const row of (await json(path.join(fixtureRoot, "manifest.json"))).cases) {
        if (publicRoot && !["hist-manual-const","hist-manual-cumulative-x"].includes(row.id)) continue;
        const page = await browser.newPage(), resources = [];
        page.on("response", res => {
          if (new URL(res.url()).pathname.includes("/resources/")) resources.push(res);
        });
        const route = "/#" + row.id;
        await page.goto(origin + route);
        await page.waitForFunction(id => location.hash === "#" + id &&
          document.querySelector("#fixture-select")?.value === id &&
          document.querySelector("#tikzkit-result:not(.is-stale) > svg") &&
          document.querySelector("#render-status")?.textContent.includes("diagnostics"), row.id);
        assert.equal(await page.locator(".CodeMirror").evaluate(el => el.CodeMirror.getValue()),
          await readFile(path.join(fixtureRoot,row.source),"utf8"));
        const data = {};
        for (const [i,r] of (row.resources || []).entries()) {
          const res = resources.find(res => new URL(res.url()).pathname === "/api/fixtures/" + row.id + "/resources/" + i);
          assert.ok(res?.ok(), row.id + ": resource was not loaded");
          data[r.name] = hash(await res.body());
          assert.equal(data[r.name], hash(await readFile(path.join(fixtureRoot,r.source))));
        }
        const downloading=page.waitForEvent("download");
        await page.locator("#download-svg-button").click();
        const download=await downloading, svgSha256=hash(await readFile(await download.path()));
        assert.equal(svgSha256, capture.rows.find(r => r.id===row.id).panels.download.svgSha256);
        if (equivalent) {
          const out=path.join(root,"equivalent-"+renderer.slice(0,12));
          await mkdir(out,{recursive:true});
          const file=path.join(out,row.id+".svg");
          execFileSync(process.execPath,[path.join(tree,"bin/tikz2svg.js"),"--strict","--math-renderer","svg-text",
            await realpath(path.join(fixtureRoot,row.source)),"-o",file]);
          assert.equal(hash(await readFile(file)),svgSha256);
        }
        records.push({route, data, svgSha256, status:await page.locator("#render-status").textContent()});
        await page.close();
      }
      assert.equal(records.length, publicRoot ? 2 : capture.rows.length);
      assert.equal(renderer,await fingerprint(),"renderer changed during direct-route check");
      const name=publicRoot ? "public-routes.json" : "routes.json";
      await save(path.join(root,equivalent ? "equivalent-"+renderer.slice(0,12) : "",name),records);
      console.log(records);
    } finally {
      await browser?.close();
      await new Promise(ok => server.close(ok));
    }
  }
}
