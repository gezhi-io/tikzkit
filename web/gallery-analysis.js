const CAPABILITY_RULES = [
  {
    command: "\\includegraphics",
    pattern: /\\includegraphics\b/,
    status: "approximated",
    note: "当前用 SVG 占位图近似；要贴近 native 需要读取真实图片资源并按 TeX 尺寸嵌入。"
  },
  {
    command: "path picture",
    pattern: /path picture\s*=/,
    status: "partial",
    note: "path picture 只识别外层样式，内部绘制还未按 PGF bounding box 执行。"
  },
  {
    command: "shading=ball",
    pattern: /(?:shading\s*=\s*ball|ball color\s*=)/,
    status: "partial",
    note: "ball shading 目前退化为普通填充；可用径向渐变近似 TikZ 球面高光。"
  },
  {
    command: "pgfplots axis",
    pattern: /\\begin\s*\{axis\}|\\addplot\b/,
    status: "partial",
    note: "PGFPlots 已支持常见 axis/addplot，但刻度、字体、clip、legend 和嵌套 axis 仍是近似。"
  },
  {
    command: "decorations",
    pattern: /decorate\b|decoration\s*=/,
    status: "partial",
    note: "markings/arrow 已实现一部分；snake、zigzag、brace 等装饰仍按普通路径近似。"
  },
  {
    command: "matrix of nodes",
    pattern: /matrix of nodes|\\matrix\b/,
    status: "partial",
    note: "matrix cell 和 anchor 已支持，row/column sep、baseline、node text metrics 还未完全等同 TeX。"
  },
  {
    command: "pic",
    pattern: /\\pic\b|pics\//,
    status: "partial",
    note: "当前覆盖图库里的 cube pic；通用 pics style args 仍需要按案例扩展。"
  },
  {
    command: "tkz-graph",
    pattern: /\\(?:Vertex|Edge|SetUpEdge|GraphInit)\b/,
    status: "approximated",
    note: "tkz-graph 被展开成普通 node/path；布局和 label 位置是兼容层近似。"
  },
  {
    command: "shape anchors",
    pattern: /shape\s*=\s*(?:diamond|ellipse|rounded rectangle)|\b(?:diamond|ellipse|rounded rectangle)\b/,
    status: "partial",
    note: "常见 anchor 可解析；复杂 shape 边界和 TeX 节点尺寸仍会造成 native diff。"
  },
  {
    command: "nested tikzpicture",
    pattern: /\\begin\s*\{tikzpicture\}[\s\S]*\\begin\s*\{tikzpicture\}/,
    status: "approximated",
    note: "节点内部嵌套 tikzpicture 会被当作文本/简化图形处理，不会完整递归排版。"
  }
];

export function buildCaseInsights(source, diagnostics = [], diffRow = null, nativeRow = null) {
  const capabilities = CAPABILITY_RULES.filter((rule) => rule.pattern.test(source)).map(({ command, status, note }) => ({
    command,
    status,
    note
  }));
  return {
    diagnosticSummary: `${diagnostics.length} diagnostic${diagnostics.length === 1 ? "" : "s"}`,
    diffSummary: formatDiffSummary(diffRow),
    nativeSummary: formatNativeSummary(nativeRow),
    severity: diffSeverity(diffRow),
    capabilities,
    recommendation: recommendationFor(capabilities, diffRow)
  };
}

export function diffSeverity(row) {
  if (!row) return "missing";
  if (row.ok) return "pass";
  const changed = Number(row.changedPixelsRatio);
  if (!Number.isFinite(changed)) return "missing";
  if (changed <= 0.08) return "near";
  if (changed <= 0.3) return "medium";
  return "large";
}

export function formatPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "n/a";
}

function formatDiffSummary(row) {
  if (!row) return "diff report missing";
  if (row.reason) return `diff ${row.reason}`;
  const mean = Number.isFinite(row.meanAbsDiff) ? row.meanAbsDiff.toFixed(4) : "n/a";
  return `diff ${row.ok ? "pass" : "fail"} · changed ${formatPercent(row.changedPixelsRatio)} · mean ${mean}`;
}

function formatNativeSummary(row) {
  if (!row) return "native PNG missing";
  if (!row.ok) return "native PNG failed";
  return row.assetFallbacks?.length ? `native PNG ok · fallback ${row.assetFallbacks.join(", ")}` : "native PNG ok";
}

function recommendationFor(capabilities, diffRow) {
  const severity = diffSeverity(diffRow);
  if (severity === "pass") return "已经在阈值内，优先保持回归。";
  if (capabilities.length === 0) return "没有明显高阶宏，优先检查节点尺寸、字体度量、线宽和 viewBox 对齐。";
  const first = capabilities[0];
  return `优先做 ${first.command} 的近似一致性；这通常比继续改 parser 更能降低视觉 diff。`;
}
