import assert from "node:assert/strict";
import test from "node:test";
import { parsePgfplotsColormaps } from "../src/pgfplots/axisOptions.js";
import { pgfplotsSurfaceColor } from "../src/pgfplots/surface.js";
import { pgfplotsMappedColor } from "../src/pgfplots/colormap.js";

function sample(definition, value, min = 0, max = 1000) {
  return pgfplotsSurfaceColor(value, { zMin: min, zMax: max }, 0, {
    "colormap name": "native",
    "pgfplots colormaps": parsePgfplotsColormaps(`{native}{${definition}}`)
  }).match(/[\d.]+/g).map(value => Number(value) / 255);
}

function near(actual, expected, tolerance = .00003) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < tolerance,
    `channel ${i}: ${value} != ${expected[i]}`));
}

// Independent values printed by metrics.ltx through pgfplotscolormapfind,
// not ideal floating-point interpolation or a snapshot of the JS renderer.
test("uniform colormaps use the native 0..1000 fixed-point lookup", () => {
  const map = "color(0cm)=(white);color(6cm)=(blue)";
  for (const [value, channel] of [[100,.89929],[250,.74823],[500,.49646],[750,.24469],[900,.09363]]) {
    near(sample(map, value), [channel, channel, 1]);
  }
  near(sample(map, 6, 0, 12), [.49648, .49648, 1]);
});

test("numeric RGB255 stops retain PGF normalization and interval rounding", () => {
  const map = "rgb255(0cm)=(12,84,180);rgb255(1cm)=(240,180,32);rgb255(2cm)=(210,40,80)";
  for (const [value, channels] of [
    [0,[.04706,.3294,.70587]], [250,[.49385,.51752,.41582]],
    [500,[.94066,.70564,.1258]], [1000,[.82362,.15744,.3135]]
  ]) near(sample(map, value), channels);
});

test("nonuniform RGB stops preserve physical positions and local interval division", () => {
  const map = "rgb(0mm)=(0,0,1);rgb(1cm)=(0,1,0);rgb(40mm)=(1,0,0)";
  near(sample(map, 100), [0,.4,.6]);
  near(sample(map, 250), [0,1,0]);
  near(sample(map, 500), [.33333,.66667,0]);
  near(sample(map, 900), [.86667,.13333,0]);
});

test("implicit gray and explicit CMYK stops are parsed without falling back to hot", () => {
  near(sample("gray=(0);gray=(1)", 500), [.50354,.50354,.50354]);
  const maps = parsePgfplotsColormaps("{native}{cmyk(0cm)=(1,0,0,0);cmyk(1cm)=(0,0,0,1)}");
  assert.equal(maps.native.length, 2);
  assert.deepEqual(maps.native[0].colorSpec, { model: "cmyk", channels: [1,0,0,0] });
  assert.deepEqual(maps.native[1].colorSpec, { model: "cmyk", channels: [0,0,0,1] });
});

test("malformed numeric color declarations are not partially accepted", () => {
  assert.deepEqual(parsePgfplotsColormaps("{bad}{rgb=(1,0);rgb=(0,1,0)}"), {});
});

test("invalid metadata and nonmonotone programmatic maps do not throw", () => {
  const stops = [{ position: 0, color: "black" }, { position: 1, color: "white" }];
  assert.equal(pgfplotsMappedColor(stops, NaN, 0, 1), null);
  assert.equal(pgfplotsMappedColor(stops, 0, 0, Infinity), null);
  assert.equal(pgfplotsMappedColor([stops[1], stops[0]], 0, 0, 1), null);
});

test("automatic positions follow the smallest previous nonuniform interval", () => {
  const map = parsePgfplotsColormaps("{native}{rgb(0cm)=(0,0,1);rgb(2cm)=(0,1,0);rgb(3cm)=(1,0,0);rgb=(1,1,0)}");
  assert.deepEqual(map.native.map(stop => stop.position), [0,2,3,4]);
});
