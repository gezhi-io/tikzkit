import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const directory = await mkdtemp(path.join(os.tmpdir(), "tikzkit-font-consumer-"));
const metadata = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", directory], {
  cwd: root, encoding: "utf8", env: { ...process.env, npm_config_cache: path.join(directory, "npm-cache") }
}))[0];
assert.ok(metadata.files.some(({ path: file }) => file === "src/fonts/index.js"));
assert.ok(!metadata.files.some(({ path: file }) => file.startsWith("web/fonts/") && /\.(otf|ttf)$/.test(file)));
assert.ok(!metadata.files.some(({ path: file }) => file.startsWith("docs/")));
const packageRoot = path.join(directory, "node_modules/@gezhi-io/tikzkit");
await mkdir(packageRoot, { recursive: true });
execFileSync("tar", ["-xzf", path.join(directory, metadata.filename), "--strip-components=1", "-C", packageRoot]);
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
for (const name of Object.keys(pkg.dependencies)) {
  await mkdir(path.dirname(path.join(directory, "node_modules", name)), { recursive: true });
  await symlink(path.join(root, "node_modules", name), path.join(directory, "node_modules", name));
}
await writeFile(path.join(directory, "package.json"), '{"private":true,"type":"module"}\n');
await writeFile(path.join(directory, "check.mjs"), String.raw`
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { tikzToSvg } from "@gezhi-io/tikzkit";
import { fontManifest } from "@gezhi-io/tikzkit/fonts";
const source = String.raw\x60\begin{tikzpicture}\node {$\displaystyle\sum_{i=1}^n x_i+\mathbb R+\mathcal A$};\end{tikzpicture}\x60;
const embedded = tikzToSvg(source);
assert.deepEqual(embedded.diagnostics, []);
assert.match(embedded.svg, /data:font\/woff;base64,/);
assert.doesNotMatch(embedded.svg, /\/node_modules\/|url\(['"]?\/fonts\//);
const shared = tikzToSvg(source, {fontUrlPrefix: './fonts/'});
assert.doesNotMatch(shared.svg, /data:font\//);
assert.match(shared.svg, /\.\/fonts\/TikZKitMath_AMSCaps-Regular.woff/);
const require = createRequire(import.meta.url);
await mkdir('fonts');
for (const file of new Set(fontManifest.flatMap(font => [font.file, font.license]))) {
  await copyFile(require.resolve('@gezhi-io/tikzkit/fonts/' + file), 'fonts/' + file);
}
await writeFile('embedded.svg', embedded.svg);
await writeFile('shared.svg', shared.svg);
console.log(JSON.stringify({fontFaces:fontManifest.length, embeddedBytes:embedded.svg.length, sharedBytes:shared.svg.length, diagnostics:embedded.diagnostics}));
`.replaceAll("\\x60", "`"));
const result = JSON.parse(execFileSync(process.execPath, ["check.mjs"], { cwd: directory, encoding: "utf8" }));
await writeFile(path.join(directory, "browser.mjs"), String.raw`
import { tikzToSvg } from '@gezhi-io/tikzkit';
const source = String.raw\x60
\pgfarrowsdeclare{audit tip}{audit tip}
  {\pgfarrowsleftextend{-3pt}\pgfarrowsrightextend{0pt}}
  {\pgfpathmoveto{\pgfpoint{0pt}{0pt}}
   \pgfpathlineto{\pgfpoint{-3pt}{1.5pt}}
   \pgfpathlineto{\pgfpoint{-3pt}{-1.5pt}}\pgfpathclose\pgfusepathqfill}
\begin{tikzpicture}
\draw[-{audit tip}] (0,0)--({max(1,sin(30))},1);
\node at (2,0) {$\displaystyle\sum_{i=1}^n x_i+\mathbb R+\mathcal A$};
\end{tikzpicture}\x60;
for (const options of [{}, {fontUrlPrefix:'./fonts/'}]) {
  const result = tikzToSvg(source, options);
  if (result.diagnostics.length) throw new Error(JSON.stringify(result.diagnostics));
  const section = document.createElement('section');
  section.innerHTML = result.svg;
  document.body.append(section);
}
await document.fonts.ready;
document.body.dataset.fontsReady = 'true';
`.replaceAll("\\x60", "`"));
await writeFile(path.join(directory, "index.html"), '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; font-src \'self\' data:; img-src \'self\' data:"><title>Packed font consumer</title><h1>Packed font consumer</h1><script type="module" src="browser.js"></script>');
console.log(JSON.stringify({ directory, packedBytes: metadata.size, unpackedBytes: metadata.unpackedSize, ...result }, null, 2));
