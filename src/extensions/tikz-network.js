import { parseOptions, splitTopLevel } from "../options.js";

// Claude: 本文件是 tikz-network 宏包的「预处理(preprocess)阶段」扩展。
// 它不直接画图，而是把 \Vertex / \Edge / \Plane / \Text / Layer 等 tikz-network
// 专有命令，在进入主 TikZ 解释器之前，改写成普通的 \node / \path / \draw / \fill。
// 整体策略：维护一份 state（顶点/边/平面/文本的「全局样式」），用手写的字符扫描器
// 逐字遍历源码，遇到本扩展认识的命令就就地替换，其余原样输出。
//
// Claude 审阅结论（详见下方各处带 "Claude:" 的注释）：
//   1. usesTikzNetwork() 的触发条件不全 —— 只有 \Vertex/\Edge/\Plane/\Text 而没有
//      \usepackage{tikz-network} 或某个 Set* 命令时，整段不会被展开。
//   2. Layer 环境与 SetLayerDistance 的「分层位移」语义被完全丢弃，只是把内容包进
//      一个 {} 作用域；嵌套 Layer 还会因 indexOf 找错 \end{Layer} 而错配。
//   3. renderVertex 里 Pseudo 顶点的 lineColor 判定条件可疑（见该处注释）。
// 这些是「功能缺口/近似」，当前测试用例都能过，但属于 codex 没做完整的地方。
export const tikzNetworkExtension = {
  name: "tikz-network",
  phase: "preprocess",
  description: "Expands practical tikz-network commands into ordinary TikZ nodes, paths, labels, and planes.",
  commands: [
    "SetDefaultUnit",
    "SetDistanceScale",
    "SetLayerDistance",
    "SetPlaneWidth",
    "SetPlaneHeight",
    "SetVertexStyle",
    "SetEdgeStyle",
    "SetPlaneStyle",
    "SetTextStyle",
    "SetCoordinates",
    "EdgesInBG",
    "EdgesNotInBG",
    "Vertex",
    "Edge",
    "Vertices",
    "Edges",
    "Plane",
    "Text",
    "Layer"
  ],
  preprocess(source, context = {}) {
    return expandTikzNetwork(source, context.diagnostics || [], context.options || {});
  }
};

const TIKZ_NETWORK_COMMANDS = new Set(tikzNetworkExtension.commands);

function expandTikzNetwork(source, diagnostics, options = {}) {
  if (!usesTikzNetwork(source)) return source;
  const state = createState();
  return expandWithState(String(source), state, diagnostics, options);
}

// Claude: 核心扫描器。逐字符扫描源码（不是用正则一把梭），目的是能正确处理嵌套括号、
// 转义反斜杠等。命中本扩展的命令就交给 expandCommand 改写，命中 Layer 环境就递归展开，
// 其它字符原样拷贝到 output。state 在整个过程中可变，用来累计 Set* 命令设置的全局样式。
function expandWithState(text, state, diagnostics, options) {
  let output = "";
  let index = 0;

  while (index < text.length) {
    if (text.startsWith("\\begin{Layer}", index)) {
      const layer = parseLayerEnvironment(text, index);
      if (!layer) {
        output += text[index];
        index += 1;
        continue;
      }
      // Claude: 这里只把 Layer 的内容递归展开后包进一个 {} 作用域，
      // 但完全没有用到 layer.options（如 [layer=2]），也没有用到 state.layerDistance。
      // 也就是说 tikz-network 的「多层 / 伪三维分层位移」语义被丢掉了：所有层都画在原位、互相重叠。
      // 若要真正支持，应根据 layer 序号 × layerDistance 给该作用域加一个 yshift/xshift。
      output += `{${expandWithState(layer.body, state, diagnostics, options)}}`;
      index = layer.end;
      continue;
    }
    if (text[index] !== "\\") {
      output += text[index];
      index += 1;
      continue;
    }
    const command = readCommandName(text, index + 1);
    if (!command || !TIKZ_NETWORK_COMMANDS.has(command.value)) {
      output += command ? text.slice(index, command.end) : text[index];
      index = command ? command.end : index + 1;
      continue;
    }
    const expanded = expandCommand(text, command.value, command.end, state, diagnostics, options);
    if (!expanded) {
      output += text.slice(index, command.end);
      index = command.end;
      continue;
    }
    output += expanded.text;
    index = expanded.end;
  }

  return output;
}

function parseLayerEnvironment(source, start) {
  let index = start + "\\begin{Layer}".length;
  const parsedOptions = parseOptionalOptions(source, index);
  index = parsedOptions.end;
  const endToken = "\\end{Layer}";
  // Claude: 用 indexOf 找第一个 \end{Layer} 来确定环境边界，对嵌套 Layer 会错配：
  // \begin{Layer}...\begin{Layer}...\end{Layer}...\end{Layer} 会在第一个 \end{Layer} 处提前收尾。
  // 另外下面返回的 options 在调用方（expandWithState）里并没有被使用，见上面的注释。
  const end = source.indexOf(endToken, index);
  if (end === -1) return null;
  return {
    options: parseOptions(parsedOptions.raw),
    body: source.slice(index, end),
    end: end + endToken.length
  };
}

// Claude: 这是「是否启用本扩展」的快速门控。问题在于触发词里只有 Vertices/Edges
// （复数批量命令）和各类 Set*，却**没有** Vertex/Edge/Plane/Text/Layer 这些单数命令。
// 后果：如果一段源码只用了 \Vertex / \Plane / \Text 而既没写 \usepackage{tikz-network}
// 也没写任何 Set* 命令，整段会被原样返回、完全不展开（已实测复现）。
// 目前 gallery 与测试都带 \usepackage{tikz-network}，所以暴露不出来，属于潜在缺口。
function usesTikzNetwork(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{tikz-network\}|\\(?:SetVertexStyle|SetEdgeStyle|SetPlaneStyle|SetTextStyle|SetDefaultUnit|SetDistanceScale|SetLayerDistance|SetPlaneWidth|SetPlaneHeight|SetCoordinates|EdgesInBG|EdgesNotInBG|Vertices|Edges)\b/.test(
    source
  );
}

function createState() {
  return {
    defaultUnit: "cm",
    distanceScale: 1,
    layerDistance: "-2cm",
    edgesInBackground: true,
    planeWidth: "5cm",
    planeHeight: "5cm",
    vertexStyle: {
      shape: "circle",
      minSize: "0.6cm",
      lineWidth: "1pt",
      lineColor: "black",
      fillColor: "#abd7e6",
      fillOpacity: "1",
      lineOpacity: "1",
      textColor: "black",
      textFont: "\\scriptsize",
      textRotation: "0",
      textOpacity: "1",
      innerSep: "2pt",
      outerSep: "0pt"
    },
    edgeStyle: {
      arrow: "-latex",
      lineWidth: "1.5pt",
      color: "black!75",
      opacity: "1",
      textFillColor: "white",
      textFillOpacity: "1",
      textColor: "black",
      textFont: "\\scriptsize",
      innerSep: "0pt",
      outerSep: "1pt"
    },
    planeStyle: {
      lineWidth: "1.5pt",
      lineColor: "black",
      lineOpacity: "1",
      gridLineWidth: ".5pt",
      gridColor: "black",
      gridOpacity: ".5",
      fillColor: "#abd7e6",
      fillOpacity: ".3"
    },
    textStyle: {
      innerSep: "2pt",
      outerSep: "0pt",
      textFont: "\\normalsize",
      textColor: "black",
      textRotation: "0",
      textOpacity: "1"
    }
  };
}

function expandCommand(source, name, afterName, state, diagnostics, options) {
  if (name === "EdgesInBG") {
    state.edgesInBackground = true;
    return { text: "", end: afterName };
  }
  if (name === "EdgesNotInBG") {
    state.edgesInBackground = false;
    return { text: "", end: afterName };
  }
  if (name === "SetDefaultUnit") return applyRequiredValue(source, afterName, (value) => (state.defaultUnit = normalizeUnit(value, state.defaultUnit)));
  if (name === "SetDistanceScale") {
    return applyRequiredValue(source, afterName, (value) => {
      const scale = Number(value.trim());
      if (Number.isFinite(scale)) state.distanceScale = scale;
    });
  }
  if (name === "SetLayerDistance") return applyRequiredValue(source, afterName, (value) => (state.layerDistance = measure(value, state.defaultUnit)));
  if (name === "SetPlaneWidth") return applyRequiredValue(source, afterName, (value) => (state.planeWidth = measure(value, state.defaultUnit)));
  if (name === "SetPlaneHeight") return applyRequiredValue(source, afterName, (value) => (state.planeHeight = measure(value, state.defaultUnit)));
  if (name === "SetCoordinates") {
    const parsed = parseOptionalOptions(source, afterName);
    return { text: "", end: parsed.end };
  }
  if (name === "SetVertexStyle") {
    const parsed = parseOptionalOptions(source, afterName);
    applyVertexStyle(state, parseOptions(parsed.raw));
    return { text: "", end: parsed.end };
  }
  if (name === "SetEdgeStyle") {
    const parsed = parseOptionalOptions(source, afterName);
    applyEdgeStyle(state, parseOptions(parsed.raw));
    return { text: "", end: parsed.end };
  }
  if (name === "SetPlaneStyle") {
    const parsed = parseOptionalOptions(source, afterName);
    applyPlaneStyle(state, parseOptions(parsed.raw));
    return { text: "", end: parsed.end };
  }
  if (name === "SetTextStyle") {
    const parsed = parseOptionalOptions(source, afterName);
    applyTextStyle(state, parseOptions(parsed.raw));
    return { text: "", end: parsed.end };
  }
  if (name === "Vertex") return parseVertex(source, afterName, state, diagnostics);
  if (name === "Edge") return parseEdge(source, afterName, state, diagnostics);
  if (name === "Vertices" || name === "Edges") return parseCsvCommand(source, afterName, name, state, diagnostics, options);
  if (name === "Plane") return parsePlane(source, afterName, state);
  if (name === "Text") return parseText(source, afterName, state, diagnostics);
  return null;
}

function applyRequiredValue(source, afterName, apply) {
  const parsed = parseRequiredGroup(source, afterName);
  if (!parsed) return null;
  apply(parsed.content);
  return { text: "", end: parsed.end };
}

function parseVertex(source, afterName, state, diagnostics) {
  const parsedOptions = parseOptionalOptions(source, afterName);
  const name = parseRequiredGroup(source, parsedOptions.end);
  if (!name) {
    diagnostics.push({ severity: "warning", message: "Could not parse tikz-network Vertex command" });
    return null;
  }
  const vertexId = name.content.trim();
  const vertexOptions = parseOptions(parsedOptions.raw);
  return {
    text: renderVertex(vertexId, vertexOptions, state),
    end: name.end
  };
}

function renderVertex(vertexId, options, state) {
  const x = coordinate(options.x, 0, state);
  const y = coordinate(options.y, 0, state);
  const size = measure(options.size || state.vertexStyle.minSize, state.defaultUnit);
  const shape = String(options.shape || state.vertexStyle.shape || "circle").trim();
  const fillColor = color(options.color || state.vertexStyle.fillColor, flag(options.RGB));
  // Claude: 这个三元条件很可疑。把描边设为 "none" 的前提是「同时」satisfies
  // options.fontcolor 为真 且 Pseudo 被设置 —— 但 Pseudo（占位/隐形顶点）本身和 fontcolor 没有逻辑关系，
  // 没有 fontcolor 的 Pseudo 顶点根本走不进 "none" 分支（已实测：draw 仍是 black）。
  // 实际把顶点隐形的是下面第 255 行追加的 opacity=0 一串，所以这里的特判要么写错了、要么是多余的。
  const lineColor = color(options.fontcolor && flag(options.Pseudo) ? "none" : firstDefined(options.linecolor, options.LineColor, state.vertexStyle.lineColor));
  const fillOpacity = number(firstDefined(options.opacity, options.FillOpacity), state.vertexStyle.fillOpacity);
  const styleParts = [
    "draw",
    shape,
    `minimum size=${size}`,
    `inner sep=${state.vertexStyle.innerSep}`,
    `outer sep=${state.vertexStyle.outerSep}`,
    `line width=${state.vertexStyle.lineWidth}`,
    `draw=${lineColor}`,
    `fill=${fillColor}`,
    `opacity=${fillOpacity}`,
    `draw opacity=${state.vertexStyle.lineOpacity}`,
    `text=${color(options.fontcolor || state.vertexStyle.textColor, flag(options.RGB) && options.fontcolor !== undefined)}`
  ];
  if (options.fontsize) styleParts.push(`font=${options.fontsize}`);
  else if (state.vertexStyle.textFont) styleParts.push(`font=${state.vertexStyle.textFont}`);
  if (options.fontscale) styleParts.push(`scale=${options.fontscale}`);
  if (options.style) styleParts.push(stripOuterBraces(options.style));
  if (flag(options.Pseudo)) styleParts.push("opacity=0,text opacity=0,fill opacity=0,draw opacity=0");
  const label = vertexLabel(vertexId, options);
  const text = shouldRenderVertexLabel(options) && !shouldPlaceLabelOutside(options) ? label : "";
  const node = `\\node[${joinOptions(styleParts)}] (${vertexId}) at (${x},${y}) {${text}};`;
  if (shouldPlaceLabelOutside(options)) return `${node}\n${renderExternalLabel(vertexId, label, options, state)}`;
  return node;
}

function vertexLabel(vertexId, options) {
  let label = "";
  if (flag(options.IdAsLabel)) label = vertexId;
  if (options.label !== undefined) label = String(options.label);
  if (options.Math && label && !/^\$[\s\S]*\$$/.test(label)) label = `$${label}$`;
  return label;
}

function shouldRenderVertexLabel(options) {
  return !flag(options.NoLabel) && (flag(options.IdAsLabel) || options.label !== undefined);
}

function shouldPlaceLabelOutside(options) {
  const position = String(options.position || "center").trim();
  return shouldRenderVertexLabel(options) && position && position !== "center";
}

function renderExternalLabel(vertexId, label, options, state) {
  const position = String(options.position || "above").trim();
  const distance = measure(options.distance || "2mm", state.defaultUnit);
  const shift = labelShift(position, distance);
  const labelOptions = [
    "draw=none",
    "fill=none",
    "inner sep=0",
    `text=${color(options.fontcolor || state.vertexStyle.textColor)}`
  ];
  if (options.fontsize) labelOptions.push(`font=${options.fontsize}`);
  if (options.fontscale) labelOptions.push(`scale=${options.fontscale}`);
  return `\\node[${joinOptions(labelOptions)}] at ([${shift}]${vertexId}.${anchorForPosition(position)}) {${label}};`;
}

function parseEdge(source, afterName, state, diagnostics) {
  const parsedOptions = parseOptionalOptions(source, afterName);
  let cursor = parsedOptions.end;
  const from = parseRequiredParen(source, cursor);
  if (!from) {
    diagnostics.push({ severity: "warning", message: "Could not parse tikz-network Edge source vertex" });
    return null;
  }
  cursor = from.end;
  const to = parseRequiredParen(source, cursor);
  if (!to) {
    diagnostics.push({ severity: "warning", message: "Could not parse tikz-network Edge target vertex" });
    return null;
  }
  const edgeOptions = parseOptions(parsedOptions.raw);
  return {
    text: renderEdge(from.content.trim(), to.content.trim(), edgeOptions, state),
    end: to.end
  };
}

function renderEdge(from, to, options, state) {
  const lineWidth = measure(options.lw || state.edgeStyle.lineWidth, state.defaultUnit);
  const edgeColor = color(options.color || state.edgeStyle.color, flag(options.RGB));
  const styleParts = [
    `line width=${lineWidth}`,
    `color=${edgeColor}`,
    `opacity=${number(options.opacity, state.edgeStyle.opacity)}`
  ];
  if (options.style) styleParts.push(stripOuterBraces(options.style));
  styleParts.push(flag(options.Direct) ? state.edgeStyle.arrow || "-latex" : "-");
  const edgeStyle = joinOptions(styleParts);
  const body = options.path
    ? renderPathEdge(from, to, options.path, edgeStyle)
    : from === to
      ? renderLoop(from, options, edgeStyle, state)
      : renderRegularEdge(from, to, options, edgeStyle, state);
  if (flag(options.NotInBG) || !state.edgesInBackground) return body;
  return `{[layer=background]${body}}`;
}

function renderRegularEdge(from, to, options, edgeStyle, state) {
  const edgeOptions = [];
  if (options.bend !== undefined) {
    const bend = Number(options.bend);
    if (Number.isFinite(bend) && bend < 0) edgeOptions.push(`bend right=${Math.abs(bend)}`);
    else edgeOptions.push(`bend left=${options.bend}`);
  }
  return `\\path[${edgeStyle}] (${from}) edge[${joinOptions(edgeOptions)}] ${renderEdgeLabel(options, state)} (${to});`;
}

function renderLoop(vertex, options, edgeStyle, state) {
  const direction = loopDirection(options.loopposition);
  const loopOptions = [`loop ${direction}`];
  if (options.loopsize) loopOptions.push(`looseness=${loopLooseness(options.loopsize)}`);
  return `\\path[${edgeStyle}] (${vertex}) edge[${joinOptions(loopOptions)}] ${renderEdgeLabel(options, state)} (${vertex});`;
}

function renderPathEdge(from, to, rawPath, edgeStyle) {
  const points = splitTopLevel(stripOuterBraces(rawPath), ",").map(pathPoint).filter(Boolean);
  const allPoints = [`(${from})`, ...points, `(${to})`];
  return `\\draw[${edgeStyle}] ${allPoints.join(" -- ")};`;
}

function pathPoint(raw) {
  const text = stripOuterBraces(raw).trim();
  if (!text) return null;
  if (text.startsWith("(") && text.endsWith(")")) return text;
  // Claude: 下面这两个分支返回值完全相同（都是 `(${text})`），所以 includes(",") 的判断是死代码、
  // 可直接删掉只留最后一行。不影响功能，但说明这里逻辑没写干净。
  if (text.includes(",")) return `(${text})`;
  return `(${text})`;
}

function renderEdgeLabel(options, state) {
  if (options.label === undefined || flag(options.NoLabel)) return "";
  let label = String(options.label);
  if (options.Math && label && !/^\$[\s\S]*\$$/.test(label)) label = `$${label}$`;
  const nodeOptions = [];
  if (options.distance !== undefined) nodeOptions.push(`pos=${options.distance}`);
  else nodeOptions.push("pos=.5");
  if (options.position) nodeOptions.push(stripOuterBraces(options.position));
  nodeOptions.push(
    "circle",
    `fill=${state.edgeStyle.textFillColor}`,
    `fill opacity=${state.edgeStyle.textFillOpacity}`,
    `inner sep=${state.edgeStyle.innerSep}`,
    `outer sep=${state.edgeStyle.outerSep}`,
    `text=${color(options.fontcolor || state.edgeStyle.textColor)}`
  );
  if (options.fontsize) nodeOptions.push(`font=${options.fontsize}`);
  else if (state.edgeStyle.textFont) nodeOptions.push(`font=${state.edgeStyle.textFont}`);
  if (options.fontscale) nodeOptions.push(`scale=${options.fontscale}`);
  return `node[${joinOptions(nodeOptions)}] {${label}}`;
}

function parsePlane(source, afterName, state) {
  const parsed = parseOptionalOptions(source, afterName);
  return {
    text: renderPlane(parseOptions(parsed.raw), state),
    end: parsed.end
  };
}

function renderPlane(options, state) {
  const x = coordinate(options.x, 0, state);
  const y = coordinate(options.y, 0, state);
  const width = coordinate(options.width || state.planeWidth, 5, state);
  const height = coordinate(options.height || state.planeHeight, 5, state);
  // Claude(已修复): 真实 tikz-network 的 \Plane 是画在 `canvas is yx plane` 作用域里的
  // （见 tikz-network.sty 的 \@@plane：`(x,y) rectangle ++ (width,height)`）。
  // 该坐标系把屏幕 x/y 轴对调：width 实际沿「竖直」延伸、height 沿「水平」延伸。
  // codex 原来按普通 xy 画成 (x+width, y+height)，导致平面被转置成横版、节点/文字相对平面错位。
  // 这里把屏幕上的水平/竖直跨度对调回来，与宏包一致（已用 case 101 渲染图核对通过）。
  const screenWidth = height; // 屏幕水平方向跨度
  const screenHeight = width; // 屏幕竖直方向跨度
  const fillColor = color(options.color || state.planeStyle.fillColor, flag(options.RGB));
  const fillOpacity = number(options.opacity, state.planeStyle.fillOpacity);
  const borderStyle = [
    `line width=${state.planeStyle.lineWidth}`,
    `draw=${state.planeStyle.lineColor}`,
    `draw opacity=${state.planeStyle.lineOpacity}`
  ];
  if (options.style) borderStyle.push(stripOuterBraces(options.style));
  const fillStyle = [`fill=${fillColor}`, `opacity=${fillOpacity}`];
  const pieces = [];
  const rectangle = rectangleExpression(x, y, screenWidth, screenHeight);
  if (!flag(options.NoFill)) pieces.push(`\\fill[${joinOptions(fillStyle)}] ${rectangle};`);
  if (options.grid) {
    pieces.push(
      `\\draw[line width=${state.planeStyle.gridLineWidth}, draw=${state.planeStyle.gridColor}, opacity=${state.planeStyle.gridOpacity}, step=${measure(options.grid, state.defaultUnit)}] (${x},${y}) grid ${oppositePoint(x, y, screenWidth, screenHeight)};`
    );
  }
  if (!flag(options.NoBorder)) pieces.push(`\\draw[${joinOptions(borderStyle)}] ${rectangle};`);
  return flag(options.InBG) ? `{[layer=background]${pieces.join("\n")}}` : pieces.join("\n");
}

function parseText(source, afterName, state, diagnostics) {
  const parsedOptions = parseOptionalOptions(source, afterName);
  const content = parseRequiredGroup(source, parsedOptions.end);
  if (!content) {
    diagnostics.push({ severity: "warning", message: "Could not parse tikz-network Text command" });
    return null;
  }
  return {
    text: renderTextNode(content.content, parseOptions(parsedOptions.raw), state),
    end: content.end
  };
}

function renderTextNode(content, options, state) {
  const x = coordinate(options.x, 0, state);
  const y = coordinate(options.y, 0, state);
  const styleParts = [
    "draw=none",
    "fill=none",
    `inner sep=${measure(options.InnerSep || state.textStyle.innerSep, state.defaultUnit)}`,
    `outer sep=${measure(options.OuterSep || state.textStyle.outerSep, state.defaultUnit)}`,
    `text=${color(options.color || state.textStyle.textColor, flag(options.RGB))}`,
    `opacity=${number(options.opacity, state.textStyle.textOpacity)}`
  ];
  const rotation = firstDefined(options.rotation, state.textStyle.textRotation);
  if (rotation) styleParts.push(`rotate=${rotation}`);
  if (options.anchor) styleParts.push(`anchor=${stripOuterBraces(options.anchor)}`);
  if (options.fontsize) styleParts.push(`font=${options.fontsize}`);
  else if (state.textStyle.textFont) styleParts.push(`font=${state.textStyle.textFont}`);
  if (options.width) styleParts.push(`text width=${measure(options.width, state.defaultUnit)}`);
  if (options.style) styleParts.push(stripOuterBraces(options.style));
  const shift = options.position ? `[${labelShift(options.position, measure(options.distance || "0", state.defaultUnit))}]` : "";
  return `\\node[${joinOptions(styleParts)}] at (${shift}${x},${y}) {${content}};`;
}

function parseCsvCommand(source, afterName, name, state, diagnostics, options) {
  const parsedOptions = parseOptionalOptions(source, afterName);
  const file = parseRequiredGroup(source, parsedOptions.end);
  if (!file) return null;
  if (typeof options.tikzNetworkFileResolver === "function") {
    const commandOptions = parseOptions(parsedOptions.raw);
    const resolved = options.tikzNetworkFileResolver(file.content.trim(), name, commandOptions);
    if (typeof resolved === "string") {
      return {
        text: renderCsv(resolved, name, state, commandOptions, diagnostics),
        end: file.end
      };
    }
  }
  diagnostics.push({
    severity: "warning",
    message: `tikz-network ${name} CSV import requires options.tikzNetworkFileResolver: ${file.content.trim()}`
  });
  return { text: "", end: file.end };
}

function renderCsv(content, command, state, commandOptions, diagnostics) {
  const rows = parseCsv(content);
  if (!rows.length) return "";
  if (command === "Vertices") {
    return rows
      .map((row) => {
        const id = firstDefined(row.id, row.Id, row.name, row.Name);
        if (!id) {
          diagnostics.push({ severity: "warning", message: "tikz-network Vertices CSV row is missing id" });
          return "";
        }
        return renderVertex(String(id).trim(), { ...commandOptions, ...vertexRowOptions(row) }, state);
      })
      .filter(Boolean)
      .join("\n");
  }
  return rows
    .map((row) => {
      const from = firstDefined(row.u, row.U, row.source, row.Source, row.from, row.From);
      const to = firstDefined(row.v, row.V, row.target, row.Target, row.to, row.To);
      if (!from || !to) {
        diagnostics.push({ severity: "warning", message: "tikz-network Edges CSV row is missing u/v endpoints" });
        return "";
      }
      return renderEdge(String(from).trim(), String(to).trim(), { ...commandOptions, ...edgeRowOptions(row) }, state);
    })
    .filter(Boolean)
    .join("\n");
}

function vertexRowOptions(row) {
  return compact({
    x: row.x,
    y: row.y,
    label: row.label,
    size: row.size,
    opacity: row.opacity,
    layer: row.layer,
    style: row.style,
    shape: row.shape,
    position: row.position,
    distance: row.distance,
    fontcolor: firstDefined(row.fontcolor, row.fontColor, row.FontColor),
    fontsize: firstDefined(row.fontsize, row.fontSize, row.FontSize),
    RGB: row.RGB || hasRgb(row),
    IdAsLabel: csvBoolean(firstDefined(row.IdAsLabel, row.idAsLabel)),
    NoLabel: csvBoolean(firstDefined(row.NoLabel, row.noLabel)),
    Math: csvBoolean(row.Math),
    Pseudo: csvBoolean(row.Pseudo),
    color: hasRgb(row) ? `${row.R},${row.G},${row.B}` : row.color
  });
}

function edgeRowOptions(row) {
  return compact({
    label: row.label,
    lw: row.lw,
    path: row.path,
    color: hasRgb(row) ? `${row.R},${row.G},${row.B}` : row.color,
    opacity: row.opacity,
    bend: row.bend,
    position: row.position,
    distance: row.distance,
    loopsize: row.loopsize,
    loopposition: row.loopposition,
    loopshape: row.loopshape,
    style: row.style,
    fontcolor: firstDefined(row.fontcolor, row.fontColor, row.FontColor),
    fontsize: firstDefined(row.fontsize, row.fontSize, row.FontSize),
    RGB: row.RGB || hasRgb(row),
    Direct: csvBoolean(row.Direct),
    Math: csvBoolean(row.Math),
    NoLabel: csvBoolean(row.NoLabel),
    NotInBG: csvBoolean(row.NotInBG)
  });
}

function applyVertexStyle(state, options) {
  if (options.Shape) state.vertexStyle.shape = String(options.Shape).trim();
  if (options.MinSize) state.vertexStyle.minSize = measure(options.MinSize, state.defaultUnit);
  if (options.LineWidth) state.vertexStyle.lineWidth = String(options.LineWidth).trim();
  if (options.LineColor) state.vertexStyle.lineColor = color(options.LineColor);
  if (options.LineOpacity) state.vertexStyle.lineOpacity = String(options.LineOpacity).trim();
  if (options.FillColor) state.vertexStyle.fillColor = color(options.FillColor);
  if (options.FillOpacity) state.vertexStyle.fillOpacity = String(options.FillOpacity).trim();
  if (options.TextColor) state.vertexStyle.textColor = color(options.TextColor);
  if (options.TextFont) state.vertexStyle.textFont = String(options.TextFont).trim();
  if (options.TextRotation) state.vertexStyle.textRotation = String(options.TextRotation).trim();
  if (options.TextOpacity) state.vertexStyle.textOpacity = String(options.TextOpacity).trim();
  if (options.InnerSep) state.vertexStyle.innerSep = measure(options.InnerSep, state.defaultUnit);
  if (options.OuterSep) state.vertexStyle.outerSep = measure(options.OuterSep, state.defaultUnit);
}

function applyEdgeStyle(state, options) {
  if (options.Arrow) state.edgeStyle.arrow = String(options.Arrow).trim();
  if (options.LineWidth) state.edgeStyle.lineWidth = String(options.LineWidth).trim();
  if (options.Color) state.edgeStyle.color = color(options.Color);
  if (options.Opacity) state.edgeStyle.opacity = String(options.Opacity).trim();
  if (options.TextColor) state.edgeStyle.textColor = color(options.TextColor);
  if (options.TextFillColor) state.edgeStyle.textFillColor = color(options.TextFillColor);
  if (options.TextFillOpacity) state.edgeStyle.textFillOpacity = String(options.TextFillOpacity).trim();
  if (options.TextFont) state.edgeStyle.textFont = String(options.TextFont).trim();
  if (options.InnerSep) state.edgeStyle.innerSep = measure(options.InnerSep, state.defaultUnit);
  if (options.OuterSep) state.edgeStyle.outerSep = measure(options.OuterSep, state.defaultUnit);
}

function applyPlaneStyle(state, options) {
  if (options.LineWidth) state.planeStyle.lineWidth = String(options.LineWidth).trim();
  if (options.LineColor) state.planeStyle.lineColor = color(options.LineColor);
  if (options.LineOpacity) state.planeStyle.lineOpacity = String(options.LineOpacity).trim();
  if (options.GridLineWidth) state.planeStyle.gridLineWidth = String(options.GridLineWidth).trim();
  if (options.GridColor) state.planeStyle.gridColor = color(options.GridColor);
  if (options.GridOpacity) state.planeStyle.gridOpacity = String(options.GridOpacity).trim();
  if (options.FillColor) state.planeStyle.fillColor = color(options.FillColor);
  if (options.FillOpacity) state.planeStyle.fillOpacity = String(options.FillOpacity).trim();
}

function applyTextStyle(state, options) {
  if (options.InnerSep) state.textStyle.innerSep = measure(options.InnerSep, state.defaultUnit);
  if (options.OuterSep) state.textStyle.outerSep = measure(options.OuterSep, state.defaultUnit);
  if (options.TextFont) state.textStyle.textFont = String(options.TextFont).trim();
  if (options.TextColor) state.textStyle.textColor = color(options.TextColor);
  if (options.TextRotation) state.textStyle.textRotation = String(options.TextRotation).trim();
  if (options.TextOpacity) state.textStyle.textOpacity = String(options.TextOpacity).trim();
}

// Claude: 把 x/y/width 这类坐标值转成 TikZ 用的无单位数字（默认按 cm）。
// 只有当去掉已知单位后是个有限数字时，才乘上 distanceScale 并四舍五入；
// 否则（比如带宏或表达式）原样返回字符串 —— 此时 distanceScale 不会作用到它上面。
function coordinate(value, fallback, state) {
  if (value === undefined || value === null || value === "") return fallback;
  const text = stripOuterBraces(value).trim();
  const withoutUnit = stripKnownUnit(text);
  const numberValue = Number(withoutUnit);
  if (Number.isFinite(numberValue)) return round(numberValue * state.distanceScale);
  return text;
}

function measure(value, defaultUnit) {
  const text = stripOuterBraces(value).trim();
  if (!text) return `0${defaultUnit}`;
  if (/[A-Za-z\\]/.test(text)) return text;
  return `${text}${defaultUnit}`;
}

function stripKnownUnit(text) {
  return String(text).replace(/(?:cm|mm|pt|in|em|ex)$/i, "");
}

function number(value, fallback) {
  const text = value === undefined || value === null || value === "" ? fallback : value;
  return String(text).trim();
}

function color(value, isRgb = false) {
  const text = stripOuterBraces(value ?? "").trim();
  if (!text) return "black";
  if (isRgb) {
    const channels = splitTopLevel(text, ",").map((part) => Number(part.trim()));
    if (channels.length === 3 && channels.every((channel) => Number.isFinite(channel))) {
      return `rgb(${channels.map((channel) => Math.round(Math.max(0, Math.min(255, channel)))).join(" ")})`;
    }
  }
  return text;
}

function rectangleExpression(x, y, width, height) {
  return `(${x},${y}) rectangle ${oppositePoint(x, y, width, height)}`;
}

function oppositePoint(x, y, width, height) {
  const x2 = addNumeric(x, width);
  const y2 = addNumeric(y, height);
  return `(${x2},${y2})`;
}

function addNumeric(a, b) {
  const left = Number(stripKnownUnit(a));
  const right = Number(stripKnownUnit(b));
  if (Number.isFinite(left) && Number.isFinite(right)) return round(left + right);
  return `{${a}+${b}}`;
}

function labelShift(position, distance) {
  const direction = String(position || "above").trim();
  const shifts = [];
  if (direction.includes("below")) shifts.push(`yshift=-${distance}`);
  else if (direction.includes("above")) shifts.push(`yshift=${distance}`);
  if (direction.includes("left")) shifts.push(`xshift=-${distance}`);
  else if (direction.includes("right")) shifts.push(`xshift=${distance}`);
  return shifts.join(",");
}

function anchorForPosition(position) {
  const direction = String(position || "above").trim();
  if (direction.includes("below")) return "south";
  if (direction.includes("left")) return "west";
  if (direction.includes("right")) return "east";
  return "north";
}

function loopDirection(rawAngle) {
  const angle = normalizeAngle(Number(rawAngle ?? 0));
  if (angle >= 45 && angle < 135) return "above";
  if (angle >= 135 && angle < 225) return "left";
  if (angle >= 225 && angle < 315) return "below";
  return "right";
}

// Claude: 这是把 tikz-network 的 loopsize（自环的物理尺寸，如 .45cm）粗略地映射成
// TikZ 的 looseness（曲线松紧系数），公式 numeric*2 再夹到 [0.7, 3] 纯属经验近似，
// 并不是真正按尺寸还原自环大小。同理 loopposition 只被 loopDirection() 量化成 4 个方向，
// loopshape 选项则被直接忽略。自环的视觉效果因此只是「形似」，不精确。
function loopLooseness(value) {
  const numeric = Number(String(value || "").trim().replace(/[A-Za-z]+$/, ""));
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(0.7, Math.min(3, numeric * 2));
}

function normalizeAngle(angle) {
  if (!Number.isFinite(angle)) return 0;
  return ((angle % 360) + 360) % 360;
}

function parseCsv(content) {
  const rows = parseCsvRows(content);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      const entry = {};
      headers.forEach((header, index) => {
        if (!header) return;
        entry[header] = row[index]?.trim() ?? "";
      });
      return entry;
    });
}

function parseCsvRows(content) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const text = String(content || "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function parseOptionalOptions(text, start) {
  let index = skipWhitespace(text, start);
  if (text[index] !== "[") return { raw: "", end: index };
  const parsed = extractBalanced(text, index, "[", "]");
  if (!parsed) return { raw: "", end: index };
  return { raw: parsed.content, end: parsed.end };
}

function parseRequiredGroup(source, start) {
  const cursor = skipWhitespace(source, start);
  return extractBalanced(source, cursor, "{", "}");
}

function parseRequiredParen(source, start) {
  const cursor = skipWhitespace(source, start);
  return extractBalanced(source, cursor, "(", ")");
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\" && index + 1 < text.length) {
      index += 1;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return { content: text.slice(start + 1, index), start, end: index + 1 };
    }
  }
  return null;
}

function readCommandName(source, start) {
  const match = source.slice(start).match(/^[A-Za-z@]+/);
  if (!match) return null;
  return { value: match[0], end: start + match[0].length };
}

function skipWhitespace(text, index) {
  let cursor = index;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  return cursor;
}

function stripOuterBraces(value) {
  let text = String(value ?? "").trim();
  while (text.startsWith("{") && text.endsWith("}")) {
    const balanced = extractBalanced(text, 0, "{", "}");
    if (!balanced || balanced.end !== text.length) break;
    text = balanced.content.trim();
  }
  return text;
}

function flag(value) {
  if (value === undefined || value === null || value === false) return false;
  if (value === true) return true;
  const text = String(value).trim().toLowerCase();
  return !["", "0", "false", "no", "off"].includes(text);
}

function csvBoolean(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return flag(value);
}

function compact(object) {
  const compacted = {};
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined || value === null || value === "") continue;
    compacted[key] = value;
  }
  return compacted;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function hasRgb(row) {
  return row.R !== undefined && row.G !== undefined && row.B !== undefined;
}

function normalizeUnit(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function joinOptions(parts) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(", ");
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
