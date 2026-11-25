import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [mode,dir,port]=process.argv.slice(2);
assert.ok(dir && ["inputs","serve","public"].includes(mode),"Usage: node probe.mjs inputs|serve|public <stage> [port|playwright.mjs]");
const stage=path.resolve(dir), json=async f=>JSON.parse(await readFile(f,"utf8"));
const {tree,fixtureRoot,rows}=await json(path.join(stage,"capture.json"));
const load=file=>import(pathToFileURL(path.join(tree,file)).href);
if (mode==="public") {
  const gallery=fileURLToPath(new URL("../examples/",import.meta.url));
  const {createWorkbenchServer}=await load("web/server.js");
  const server=await createWorkbenchServer({fixtureRoot:gallery});
  await new Promise((ok,fail)=>server.once("error",fail).listen(0,"127.0.0.1",ok));
  let browser;
  try {
    browser=await (await import(pathToFileURL(path.resolve(port)).href)).chromium.launch({channel:"chrome",headless:true});
    const evidence=[],manifest=await json(path.join(gallery,"manifest.json"));
    for (const id of ["matrix-manual-table","matrix-manual-nan-colorbar"]) {
      const fixture=manifest.cases.find(r=>r.id===id),canonical=path.join(fixtureRoot,id+".tex");
      assert.ok(fixture,"Public manifest missing "+id);
      assert.equal(await realpath(path.join(gallery,fixture.source)),await realpath(canonical));
      const page=await browser.newPage(),route="/#"+id;
      await page.goto("http://127.0.0.1:"+server.address().port+route);
      await page.waitForFunction(id=>document.querySelector("#fixture-select")?.value===id &&
        document.querySelector("#tikzkit-result:not(.is-stale) > svg") && !document.querySelector("#download-svg-button").disabled,id);
      assert.equal(await page.locator(".CodeMirror").evaluate(e=>e.CodeMirror.getValue()),await readFile(canonical,"utf8"));
      const downloading=page.waitForEvent("download");
      await page.locator("#download-svg-button").click();
      const file=await (await downloading).path(),hash=createHash("sha256").update(await readFile(file)).digest("hex");
      assert.equal(hash,rows.find(r=>r.id===id).panels.download.svgSha256);
      evidence.push({route,source:fixture.source,downloadSha256:hash,status:await page.locator("#render-status").textContent()});
      await page.close();
    }
    await writeFile(path.join(stage,"public-routes.json"),JSON.stringify(evidence,null,2)+"\n");
    console.log(evidence);
  } finally {
    await browser?.close();await new Promise(ok=>server.close(ok));
  }
} else if (mode==="serve") {
  const {createWorkbenchServer}=await load("web/server.js");
  const server=await createWorkbenchServer({fixtureRoot,outputRoot:stage});
  server.listen(Number(port||0),"127.0.0.1",()=>console.log("http://127.0.0.1:"+server.address().port+"/#matrix-manual-explicit-hole"));
} else {
  const archive=execFileSync("kpsewhich",["-format=TeX system documentation","pgfplots.doc.src.tar.bz2"],{encoding:"utf8"}).trim();
  const manual=execFileSync("tar",["-xOf",archive,"pgfplots.reference.3dplots.tex"],{encoding:"utf8"}).split("\n");
  const {parseAddplots}=await load("src/pgfplots/addplotParser.js");
  const inputs={};
  for (const item of (await json(path.join(fixtureRoot,"manifest.json"))).cases) {
    const {id,source,manualLines:[a,b]}=item, tex=await readFile(path.join(fixtureRoot,source),"utf8");
    const body=manual.slice(a-1,b).join("\n")+"\n";
    assert.equal(tex.slice(tex.indexOf("\\begin{tikzpicture}"),tex.indexOf("\\end{document}")),body);
    assert.equal(await readFile(path.join(stage,".mactex-work",id,"reference.tex"),"utf8"),tex);
    const sha=createHash("sha256").update(tex).digest("hex");
    assert.equal(sha,rows.find(r=>r.id===id).sourceSha256);
    const diagnostics=[],[plot]=parseAddplots(body,{},diagnostics);
    inputs[id]={sourceSha256:sha,manualLines:[a,b],sourceBlankLines:body.split("\n").slice(0,-1).filter(l=>!l.trim()).length,
      meshCols:plot.options?.["mesh/cols"]??null,pointCount:plot.points.length,
      scanlines:(plot.coordinateRows||plot.points.rows)?.map(row=>row.length)??null,
      points:plot.points.map(p=>({x:p.x,y:p.y,...("meta" in p?{meta:p.meta}:{})})),diagnostics};
    console.log(id,inputs[id].pointCount,"points; parser scanlines:",inputs[id].scanlines);
  }
  await writeFile(path.join(stage,"inputs.json"),JSON.stringify(inputs,null,2)+"\n");
}
