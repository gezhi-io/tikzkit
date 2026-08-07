import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { styleAttributes } from "./style.js";

const CIRCUITIKZ_NODE_SHAPES = new Set([
  "opAmp",
  "circuitikzMosfet",
  "circuitikzTransistor",
  "circuitikzTriode",
  "circuitikzPentode",
  "circuitikzTetrode",
  "circuitikzDiodeTube",
  "circuitikzQuadpole"
]);

export function isCircuitikzNodeShape(shape) {
  return CIRCUITIKZ_NODE_SHAPES.has(shape);
}

export function renderCircuitikzNodeBox(item, unit) {
  if (item.shape === "opAmp") return renderCircuitikzOpAmpNodeBox(item, unit);
  if (item.shape === "circuitikzMosfet") return renderCircuitikzMosfetNodeBox(item, unit);
  if (item.shape === "circuitikzTransistor") return renderCircuitikzTransistorNodeBox(item, unit);
  if (item.shape === "circuitikzTriode") return renderCircuitikzTriodeNodeBox(item, unit);
  if (["circuitikzPentode", "circuitikzTetrode", "circuitikzDiodeTube"].includes(item.shape)) {
    return renderCircuitikzTubeNodeBox(item, unit);
  }
  if (item.shape === "circuitikzQuadpole") return renderCircuitikzQuadpoleNodeBox(item, unit);
  return "";
}

function renderCircuitikzMosfetNodeBox(item, unit) {
  const cx = item.x;
  const cy = item.y;
  const width = item.width;
  const halfHeight = item.height / 2;
  const kind = item.shapeData?.mosfetKind || "nmos";
  const left = -width;
  const right = 0;
  const baseX = left * 0.5;
  const gateX = left * 0.62;
  const gateHeight = halfHeight * 0.35;
  const baseHeight = halfHeight * 0.5;
  const stroke = item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black";
  const body = [
    moveLine({ x: right, y: halfHeight }, { x: right, y: gateHeight }),
    lineTo({ x: baseX, y: gateHeight }),
    moveLine({ x: baseX, y: -gateHeight }, { x: right, y: -gateHeight }),
    lineTo({ x: right, y: -halfHeight }),
    moveLine({ x: baseX, y: baseHeight }, { x: baseX, y: -baseHeight }),
    moveLine({ x: gateX, y: gateHeight }, { x: gateX, y: -gateHeight }),
    moveLine({ x: gateX, y: 0 }, { x: left, y: 0 })
  ].join(" ");
  const parts = [
    `<g class="tikz-node-shape tikz-node-circuitikzMosfet tikz-node-circuitikzMosfet-${escapeAttribute(kind)}">`,
    `<path d="${localPathData(body, cx, cy, unit)}"${styleAttributes(item.style)} />`
  ];
  if (item.shapeData?.mosfetArrows) {
    const from = kind === "nmos" ? { x: gateX, y: -gateHeight } : { x: right, y: gateHeight };
    const to = kind === "nmos" ? { x: right, y: -gateHeight } : { x: gateX, y: gateHeight };
    const points = transistorArrowPolygon(from, to, item)
      .map((point) => `${format((cx + point.x) * unit)},${format(-(cy + point.y) * unit)}`)
      .join(" ");
    parts.push(`<polygon class="tikz-node-circuitikzMosfet-arrow" points="${points}" fill="${escapeAttribute(stroke)}" stroke="none" />`);
  }
  if (kind === "pmos" && !item.shapeData?.mosfetNoCircle) {
    const radius = Math.max(0.035, Math.min(0.07, width * 0.1));
    const fill = item.shapeData?.mosfetEmptyCircle ? "white" : stroke;
    parts.push(
      `<circle class="tikz-node-circuitikzMosfet-gate-circle" cx="${format((cx + gateX - radius) * unit)}" cy="${format(-cy * unit)}" r="${format(radius * unit)}" fill="${escapeAttribute(fill)}" stroke="${escapeAttribute(stroke)}" stroke-width="${format(item.style?.lineWidth || 1)}" />`
    );
  }
  parts.push(`</g>`);
  return parts.join("");
}

function renderCircuitikzOpAmpNodeBox(item, unit) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const hw = (item.width / 2) * unit;
  const hh = (item.height / 2) * unit;
  const left = cx - hw;
  const right = cx + hw;
  const top = cy - hh;
  const bottom = cy + hh;
  const portWidth = 0.7;
  const triangleLeft = cx - hw * portWidth;
  const triangleRight = cx + hw * portWidth;
  const points = `${format(triangleLeft)},${format(top)} ${format(triangleLeft)},${format(bottom)} ${format(triangleRight)},${format(cy)}`;
  const stroke = item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black";
  const inputYOffset = hh * 0.5;
  const plusY = item.shapeData?.opAmpNoInvInputUp === false ? cy + inputYOffset : cy - inputYOffset;
  const minusY = item.shapeData?.opAmpNoInvInputUp === false ? cy - inputYOffset : cy + inputYOffset;
  const signX = triangleLeft + hw * 0.16;
  const signSize = Math.max(2.4, Math.min(hw, hh) * 0.12);
  const signWidth = Math.max(0.65, (item.style?.lineWidth || 1) * 0.75);
  const signs = [
    `M ${format(left)} ${format(plusY)} L ${format(triangleLeft)} ${format(plusY)}`,
    `M ${format(left)} ${format(minusY)} L ${format(triangleLeft)} ${format(minusY)}`,
    `M ${format(right)} ${format(cy)} L ${format(triangleRight)} ${format(cy)}`,
    `M ${format(signX - signSize)} ${format(plusY)} L ${format(signX + signSize)} ${format(plusY)}`,
    `M ${format(signX)} ${format(plusY - signSize)} L ${format(signX)} ${format(plusY + signSize)}`,
    `M ${format(signX - signSize)} ${format(minusY)} L ${format(signX + signSize)} ${format(minusY)}`
  ].join(" ");
  return [
    `<polygon class="tikz-node-shape tikz-node-opAmp" points="${points}"${styleAttributes(item.style)} />`,
    `<path class="tikz-node-opAmp-polarity" d="${signs}" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${format(
      signWidth
    )}" stroke-linecap="butt" />`
  ].join("");
}

function renderCircuitikzTransistorNodeBox(item, unit) {
  const cx = item.x;
  const cy = item.y;
  const hh = item.height / 2;
  const xSign = item.shapeData?.transistorXScale < 0 ? -1 : 1;
  const kind = item.shapeData?.transistorKind || "npn";
  const scale = hh > 0 ? hh / 0.775 : 1;
  const terminalX = 0;
  const baseX = -xSign * 0.418 * scale;
  const baseLead = { x: -xSign * 0.844 * scale, y: 0 };
  const terminalY = 0.775 * scale;
  const stubY = 0.307 * scale;
  const diagonalY = 0.115 * scale;
  const c = { x: terminalX, y: kind === "pnp" ? -terminalY : terminalY };
  const e = { x: terminalX, y: kind === "pnp" ? terminalY : -terminalY };
  const cStub = { x: terminalX, y: Math.sign(c.y || 1) * stubY };
  const eStub = { x: terminalX, y: Math.sign(e.y || -1) * stubY };
  const cBase = { x: baseX, y: Math.sign(c.y || 1) * diagonalY };
  const eBase = { x: baseX, y: Math.sign(e.y || -1) * diagonalY };
  const body = [
    moveLine(baseLead, { x: baseX, y: 0 }),
    moveLine({ x: baseX, y: -stubY }, { x: baseX, y: stubY }),
    moveLine(c, cStub),
    moveLine(cStub, cBase),
    moveLine(eBase, eStub),
    moveLine(eStub, e)
  ].join(" ");
  const arrow = transistorArrowPolygon(kind === "npn" ? eBase : eStub, kind === "npn" ? eStub : eBase, item);
  const stroke = item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black";
  const arrowPoints = arrow
    .map((point) => `${format((cx + point.x) * unit)},${format(-(cy + point.y) * unit)}`)
    .join(" ");
  return [
    `<g class="tikz-node-shape tikz-node-circuitikzTransistor tikz-node-circuitikzTransistor-${escapeAttribute(kind)}">`,
    `<path d="${localPathData(body, cx, cy, unit)}"${styleAttributes(item.style)} />`,
    `<polygon class="tikz-node-circuitikzTransistor-arrow" points="${arrowPoints}" fill="${escapeAttribute(stroke)}" stroke="none" />`,
    `</g>`
  ].join("");
}

function renderCircuitikzTriodeNodeBox(item, unit) {
  const cx = item.x;
  const cy = item.y;
  const hw = item.width / 2;
  const hh = item.height / 2;
  const stroke = item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black";
  const lineWidth = item.style?.lineWidth || 1;
  const tubeRadius = Math.min(hw * 0.82, hh * 0.62);
  const rx = tubeRadius;
  const ry = tubeRadius;
  const anodeY = hh * 0.4;
  const cathodeY = -hh * 0.4;
  const cathodeX = hw * 0.4;
  const gridX = -hw * 0.18;
  const gridLeft = -hw;
  const gridDashCount = 5;
  const dashGap = (ry * 1.6) / (gridDashCount * 2 - 1);
  const body = [
    moveLine({ x: 0, y: hh }, { x: 0, y: anodeY }),
    moveLine({ x: -hw * 0.28, y: anodeY }, { x: hw * 0.28, y: anodeY }),
    moveLine({ x: cathodeX, y: cathodeY }, { x: cathodeX, y: -hh }),
    moveLine({ x: -hw * 0.25, y: cathodeY }, { x: cathodeX + hw * 0.08, y: cathodeY }),
    moveLine({ x: gridLeft, y: 0 }, { x: gridX - hw * 0.08, y: 0 })
  ];
  for (let index = 0; index < gridDashCount; index += 1) {
    const y = -ry * 0.55 + index * dashGap * 2;
    body.push(moveLine({ x: gridX, y }, { x: gridX, y: y + dashGap }));
  }
  return [
    `<g class="tikz-node-shape tikz-node-circuitikzTriode">`,
    `<ellipse class="tikz-node-circuitikzTriode-outline" cx="${format(cx * unit)}" cy="${format(
      -cy * unit
    )}" rx="${format(rx * unit)}" ry="${format(ry * unit)}" fill="none" stroke="${escapeAttribute(
      stroke
    )}" stroke-width="${format(lineWidth)}" />`,
    `<path class="tikz-node-circuitikzTriode-body" d="${localPathData(body.join(" "), cx, cy, unit)}" fill="none" stroke="${escapeAttribute(
      stroke
    )}" stroke-width="${format(lineWidth)}" stroke-linecap="butt" stroke-linejoin="round" />`,
    `</g>`
  ].join("");
}

function renderCircuitikzTubeNodeBox(item, unit) {
  const cx = item.x;
  const cy = item.y;
  const halfWidth = item.width / 2;
  const halfHeight = item.height / 2;
  const stroke = item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black";
  const fill = item.style?.fill || "none";
  const lineWidth = item.style?.lineWidth || 1;
  const tubeRx = halfWidth * 0.8;
  const tubeRy = halfHeight * 0.8;
  const outline = tubeCapsulePath(tubeRx, tubeRy);
  const partial = item.shapeData?.partialBorders || "none";
  const parts = [
    `<g class="tikz-node-shape tikz-node-circuitikzTube tikz-node-${escapeAttribute(item.shape)}">`,
    `<path class="tikz-node-circuitikzTube-fill" d="${localTubePathData(outline.full, cx, cy, unit)}" fill="${escapeAttribute(
      fill
    )}" stroke="none" />`
  ];
  if (/^[012]{6}$/.test(partial)) {
    for (let index = 0; index < outline.parts.length; index += 1) {
      const styleCode = Number(partial[index]);
      if (styleCode === 0) continue;
      const dash = styleCode === 2 ? ` stroke-dasharray="${format(2 * lineWidth)} ${format(2 * lineWidth)}"` : "";
      parts.push(
        `<path class="tikz-node-circuitikzTube-border" d="${localTubePathData(outline.parts[index], cx, cy, unit)}" fill="none" stroke="${escapeAttribute(
          stroke
        )}" stroke-width="${format(lineWidth)}"${dash} stroke-linecap="butt" stroke-linejoin="round" />`
      );
    }
  } else {
    parts.push(
      `<path class="tikz-node-circuitikzTube-border" d="${localTubePathData(outline.full, cx, cy, unit)}" fill="none" stroke="${escapeAttribute(
        stroke
      )}" stroke-width="${format(lineWidth)}" stroke-linejoin="round" />`
    );
  }
  parts.push(
    `<path class="tikz-node-circuitikzTube-electrodes" d="${localTubePathData(
      circuitikzTubeElectrodePath(item),
      cx,
      cy,
      unit
    )}" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${format(lineWidth)}" stroke-linecap="butt" stroke-linejoin="round" />`,
    `</g>`
  );
  return parts.join("");
}

function renderCircuitikzQuadpoleNodeBox(item, unit) {
  const kind = item.shapeData?.quadpoleKind || "transformer";
  const cx = item.x;
  const cy = item.y;
  const stroke = item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black";
  const lineWidth = item.style?.lineWidth || 1;
  const style = {
    ...item.style,
    stroke,
    fill: "none",
    lineWidth,
    lineCap: "butt",
    lineJoin: "round"
  };
  const body = kind === "gyrator"
    ? `<path class="tikz-node-circuitikzQuadpole-body" d="${localTubePathData(circuitikzGyratorCommands(item), cx, cy, unit)}"${styleAttributes(
      style,
      { lineCap: "butt", lineJoin: "round" }
    )} />`
    : renderCircuitikzTransformerBody(item, unit, cx, cy, style, lineWidth);
  const core = kind === "transformer core" ? renderCircuitikzTransformerCore(item, unit, cx, cy, stroke, lineWidth * 2) : "";
  return `<g class="tikz-node-shape tikz-node-circuitikzQuadpole tikz-node-circuitikzQuadpole-${escapeAttribute(
    kind.replace(/\s+/g, "-")
  )}">${body}${core}</g>`;
}

function renderCircuitikzTransformerBody(item, unit, cx, cy, style, lineWidth) {
  const paths = circuitikzTransformerPaths(item);
  const leadStyle = { ...style, lineWidth };
  // Circuitikz's cuteinductor shape resets to the path's starting line width;
  // in the default transformer that is twice the outer lead width.
  const coilStyle = { ...style, lineWidth: lineWidth * 2, lineJoin: "bevel" };
  return [
    `<path class="tikz-node-circuitikzQuadpole-body tikz-node-circuitikzQuadpole-leads" d="${localTubePathData(paths.leads, cx, cy, unit)}"${styleAttributes(
      leadStyle,
      { lineCap: "butt", lineJoin: "round" }
    )} />`,
    `<path class="tikz-node-circuitikzQuadpole-coils" d="${localTubePathData(paths.coils, cx, cy, unit)}"${styleAttributes(
      coilStyle,
      { lineCap: "butt", lineJoin: "bevel" }
    )} />`
  ].join("");
}

function renderCircuitikzTransformerCore(item, unit, cx, cy, stroke, lineWidth) {
  const settings = item.shapeData?.quadpoleSettings?.core || {};
  const dashArray = settings.dashMode === "custom"
    ? settings.dashArray
    : settings.dashMode === "solid"
      ? undefined
      : item.style?.dashArray;
  const coreStyle = {
    ...item.style,
    stroke: settings.color || stroke,
    fill: "none",
    lineWidth: lineWidth * (Number.isFinite(settings.relativeThickness) ? settings.relativeThickness : 1),
    dashArray,
    lineCap: "butt",
    lineJoin: "round"
  };
  return `<path class="tikz-node-circuitikzQuadpole-core" d="${localTubePathData(
    circuitikzTransformerCoreCommands(item),
    cx,
    cy,
    unit
  )}"${styleAttributes(coreStyle, { lineCap: "butt", lineJoin: "round" })} />`;
}

function circuitikzTransformerPaths(item) {
  const hw = item.width / 2;
  const hh = item.height / 2;
  const inner = circuitikzQuadpoleInnerRatio(item);
  const leftCoilX = -hw * inner;
  const rightCoilX = hw * inner;
  const leftSpec = item.shapeData?.quadpoleSettings?.coils?.L1 || {};
  const rightSpec = item.shapeData?.quadpoleSettings?.coils?.L2 || {};
  const leftGeometry = circuitikzTransformerCoilGeometry(hh, leftSpec);
  const rightGeometry = circuitikzTransformerCoilGeometry(hh, rightSpec);
  return {
    leads: [
      ["M", -hw, hh],
      ["L", leftCoilX, hh],
      ["L", leftCoilX, leftGeometry.halfSpan],
      ["M", leftCoilX, -leftGeometry.halfSpan],
      ["L", leftCoilX, -hh],
      ["L", -hw, -hh],
      ["M", hw, hh],
      ["L", rightCoilX, hh],
      ["L", rightCoilX, rightGeometry.halfSpan],
      ["M", rightCoilX, -rightGeometry.halfSpan],
      ["L", rightCoilX, -hh],
      ["L", hw, -hh]
    ],
    coils: [
      ...cuteTransformerCoilCommands(leftCoilX, leftGeometry, 1),
      ...cuteTransformerCoilCommands(rightCoilX, rightGeometry, -1)
    ]
  };
}

function circuitikzQuadpoleInnerRatio(item = {}) {
  const raw = Number(item.shapeData?.quadpoleSettings?.inner);
  return Number.isFinite(raw) ? Math.max(0.12, Math.min(1.1, raw)) : 0.4;
}

function circuitikzTransformerCoilTurns(spec = {}, fallback = 5) {
  const raw = Number(spec["inductors/coils"] ?? spec.coils);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(12, Math.round(raw)));
}

function circuitikzTransformerCoilGeometry(halfHeight, spec = {}) {
  // A transformer has a height of 1.5 Rlen, so its half-height is .75 Rlen.
  // This is the same geometry used by pgfcircbipoles.tex:cuteinductor.
  const rlen = halfHeight / 0.75;
  const turns = circuitikzTransformerCoilTurns(spec, 5);
  const width = circuitikzTransformerCoilOption(spec, "inductors/width", "width", 0.6, 0.1, 1.5);
  const aspect = circuitikzTransformerCoilOption(spec, "inductors/coil aspect", "coil aspect", 0.5, 0, 1);
  const coilHeight = circuitikzTransformerCoilOption(spec, "inductors/height", "height", 0.3, 0.05, 1.5);
  const lowerCoilHeight = circuitikzTransformerCoilOption(
    spec,
    "inductors/lower coil height",
    "lower coil height",
    0.15,
    0.02,
    1.5
  );
  const smallStep = turns > 1 ? (0.5 * aspect * width * rlen) / (turns - 1) : 0;
  const wideStep = (width * rlen + (turns - 1) * 2 * smallStep) / turns / 2;
  return {
    turns,
    wideStep,
    smallStep,
    wideRadius: (coilHeight * rlen) / 2,
    smallRadius: (lowerCoilHeight * rlen) / 2,
    halfSpan: turns * wideStep - (turns - 1) * smallStep
  };
}

function circuitikzTransformerCoilOption(spec, fullName, shortName, fallback, min, max) {
  const raw = Number(spec[fullName] ?? spec[shortName] ?? fallback);
  return Number.isFinite(raw) ? Math.max(min, Math.min(max, raw)) : fallback;
}

function cuteTransformerCoilCommands(x, geometry, insideDirection) {
  const commands = [["M", x, geometry.halfSpan]];
  let y = geometry.halfSpan;
  const kappa = 0.5522847498;
  for (let index = 0; index < geometry.turns; index += 1) {
    const wideEnd = y - 2 * geometry.wideStep;
    const wideMid = y - geometry.wideStep;
    const wideX = x + insideDirection * geometry.wideRadius;
    commands.push(
      ["C", x + insideDirection * geometry.wideRadius * kappa, y, wideX, y - geometry.wideStep * kappa, wideX, wideMid],
      ["C", wideX, y - geometry.wideStep * (2 - kappa), x + insideDirection * geometry.wideRadius * kappa, wideEnd, x, wideEnd]
    );
    y = wideEnd;
    if (index === geometry.turns - 1 || geometry.smallStep === 0) continue;
    const smallEnd = y + 2 * geometry.smallStep;
    const smallMid = y + geometry.smallStep;
    const smallX = x - insideDirection * geometry.smallRadius;
    commands.push(
      ["C", x - insideDirection * geometry.smallRadius * kappa, y, smallX, y + geometry.smallStep * kappa, smallX, smallMid],
      ["C", smallX, y + geometry.smallStep * (2 - kappa), x - insideDirection * geometry.smallRadius * kappa, smallEnd, x, smallEnd]
    );
    y = smallEnd;
  }
  return commands;
}

function circuitikzTransformerCoreCommands(item) {
  const hw = item.width / 2;
  const hh = item.height / 2;
  const x = hw * 0.05;
  const y = hh * 0.5;
  return [
    ["M", -x, y],
    ["L", -x, -y],
    ["M", x, y],
    ["L", x, -y]
  ];
}

function circuitikzGyratorCommands(item) {
  const hw = item.width / 2;
  const hh = item.height / 2;
  const terminalY = hh * 0.56;
  const innerX = hw * 0.34;
  const curveY = terminalY * 0.92;
  return [
    ["M", -hw, terminalY],
    ["L", -innerX, terminalY],
    ["L", -innerX, -terminalY],
    ["L", -hw, -terminalY],
    ["M", hw, terminalY],
    ["L", innerX, terminalY],
    ["L", innerX, -terminalY],
    ["L", hw, -terminalY],
    ["M", -innerX, curveY],
    ["Q", 0, 0, -innerX, -curveY],
    ["M", innerX, -curveY],
    ["Q", 0, 0, innerX, curveY]
  ];
}

function tubeCapsulePath(rx, ry) {
  if (rx > ry) {
    const straight = Math.max(0, rx - ry);
    return {
      full: [
        ["M", -straight, ry],
        ["L", straight, ry],
        ["Q", rx, ry, rx, 0],
        ["Q", rx, -ry, straight, -ry],
        ["L", -straight, -ry],
        ["Q", -rx, -ry, -rx, 0],
        ["Q", -rx, ry, -straight, ry],
        ["Z"]
      ],
      parts: [
        [["M", -rx, 0], ["Q", -rx, ry, -straight, ry]],
        [["M", -straight, ry], ["L", straight, ry]],
        [["M", straight, ry], ["Q", rx, ry, rx, 0]],
        [["M", rx, 0], ["Q", rx, -ry, straight, -ry]],
        [["M", straight, -ry], ["L", -straight, -ry]],
        [["M", -straight, -ry], ["Q", -rx, -ry, -rx, 0]]
      ]
    };
  }
  const straight = Math.max(0, ry - rx);
  return {
    full: [
      ["M", -rx, straight],
      ["Q", -rx, ry, 0, ry],
      ["Q", rx, ry, rx, straight],
      ["L", rx, -straight],
      ["Q", rx, -ry, 0, -ry],
      ["Q", -rx, -ry, -rx, -straight],
      ["L", -rx, straight],
      ["Z"]
    ],
    parts: [
      [["M", 0, ry], ["Q", rx, ry, rx, straight]],
      [["M", rx, straight], ["L", rx, -straight]],
      [["M", rx, -straight], ["Q", rx, -ry, 0, -ry]],
      [["M", 0, -ry], ["Q", -rx, -ry, -rx, -straight]],
      [["M", -rx, -straight], ["L", -rx, straight]],
      [["M", -rx, straight], ["Q", -rx, ry, 0, ry]]
    ]
  };
}

function circuitikzTubeElectrodePath(item) {
  const halfWidth = item.width / 2;
  const halfHeight = item.height / 2;
  const kind = item.shapeData?.tubeKind || "pentode";
  const grids = kind === "pentode" ? [-0.2, 0, 0.2] : kind === "tetrode" ? [-0.1, 0.1] : kind === "triode" ? [0] : [];
  const commands = [
    ["M", 0, halfHeight],
    ["L", 0, halfHeight * 0.4],
    ["M", -halfWidth * 0.4, halfHeight * 0.4],
    ["L", halfWidth * 0.4, halfHeight * 0.4],
    ["M", -halfWidth * 0.4, -halfHeight],
    ["L", -halfWidth * 0.4, -halfHeight * 0.4],
    ["L", halfWidth * 0.4, -halfHeight * 0.4],
    ["L", halfWidth * 0.4, -halfHeight * 0.475]
  ];
  for (const grid of grids) {
    const y = grid * halfHeight;
    const left = -halfWidth * 0.65;
    const right = halfWidth * 0.4;
    commands.push(["M", -halfWidth, y], ["L", left, y]);
    for (let index = 0; index < 5; index += 1) {
      const x1 = left + (right - left) * ((index * 2 + 1) / 11);
      const x2 = left + (right - left) * ((index * 2 + 2) / 11);
      commands.push(["M", x1, y], ["L", x2, y]);
    }
  }
  return commands;
}

function localTubePathData(commands, cx, cy, unit) {
  return commands
    .map((command) => {
      if (command[0] === "Z") return "Z";
      if (command[0] === "M" || command[0] === "L") return `${command[0]} ${format((cx + command[1]) * unit)} ${format(-(cy + command[2]) * unit)}`;
      if (command[0] === "Q") {
        return `Q ${format((cx + command[1]) * unit)} ${format(-(cy + command[2]) * unit)} ${format((cx + command[3]) * unit)} ${format(
          -(cy + command[4]) * unit
        )}`;
      }
      if (command[0] === "C") {
        return `C ${format((cx + command[1]) * unit)} ${format(-(cy + command[2]) * unit)} ${format((cx + command[3]) * unit)} ${format(
          -(cy + command[4]) * unit
        )} ${format((cx + command[5]) * unit)} ${format(-(cy + command[6]) * unit)}`;
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function moveLine(from, to) {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

function lineTo(to) {
  return `L ${to.x} ${to.y}`;
}

function localPathData(data, cx, cy, unit) {
  return data.replace(/([ML])\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/gi, (_match, command, x, y) => {
    const px = (cx + Number(x)) * unit;
    const py = -(cy + Number(y)) * unit;
    return `${command} ${format(px)} ${format(py)}`;
  });
}

function transistorArrowPolygon(from, to, item) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const size = Math.max(0.075, Math.min(item.width || 0.6, item.height || 1.1) * 0.14);
  const tip = {
    x: from.x + dx * 0.72,
    y: from.y + dy * 0.72
  };
  const base = {
    x: tip.x - ux * size * 1.2,
    y: tip.y - uy * size * 1.2
  };
  return [
    tip,
    { x: base.x + nx * size * 0.62, y: base.y + ny * size * 0.62 },
    { x: base.x - nx * size * 0.62, y: base.y - ny * size * 0.62 }
  ];
}
