export function parseEditorLocation(location) {
  const match = String(location || "").match(/^(\d+)(?::(\d+))?$/);
  if (!match) return null;
  const line = Number(match[1]);
  const column = Number(match[2] || 1);
  if (line < 1 || column < 1) return null;
  return { line, column };
}

function defineTikzMode(CodeMirror) {
  if (!CodeMirror || CodeMirror.modes?.tikzkit) return;
  const command = /\\(?:[A-Za-z@]+|[^A-Za-z@\s])/;
  const structuralCommand = /\\(?:addlegendentry|addplot3?|begin|coordinate|datavisualization|definecolor|draw|end|fill|foreach|node|path|pgfplotsset|tikz|tikzset|usepackage|usetikzlibrary)\b/;

  CodeMirror.defineMode("tikzkit", () => ({
    token(stream) {
      if (stream.sol() && stream.peek() === "%") {
        stream.skipToEnd();
        return "comment";
      }
      if (stream.match(structuralCommand)) return "keyword";
      if (stream.match(command)) return "builtin";
      if (stream.match(/\$\$?|\\\[|\\\]/)) return "atom";
      if (stream.match(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[a-zA-Z]+)?/)) return "number";
      if (stream.match(/[{}\[\]()]/)) return "bracket";
      if (stream.match(/[,:;|!]/)) return "operator";
      if (stream.match(/[A-Za-z_][\w-]*/)) return "variable";
      stream.next();
      return null;
    }
  }));
}

function editorMarker(severity, messages) {
  const marker = document.createElement("span");
  marker.className = `tikz-editor-marker tikz-editor-marker-${severity}`;
  marker.textContent = severity === "error" ? "!" : severity === "warning" ? "!" : "i";
  marker.title = messages.join("\n");
  marker.setAttribute("aria-label", messages.join(" "));
  return marker;
}

export function diagnosticGroups(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const location = parseEditorLocation(row.location);
    if (!location) continue;
    const entry = grouped.get(location.line) || { severity: "info", messages: [] };
    if (row.severity === "error") entry.severity = "error";
    else if (row.severity === "warning" && entry.severity !== "error") entry.severity = "warning";
    entry.messages.push(`${row.code || "tikz-diagnostic"}: ${row.message || "Diagnostic"}`);
    grouped.set(location.line, entry);
  }
  return grouped;
}

function nativeOffset(value, location) {
  const parsed = parseEditorLocation(location);
  if (!parsed) return null;
  const lines = String(value || "").split("\n");
  if (parsed.line > lines.length) return null;
  const before = lines.slice(0, parsed.line - 1).reduce((total, line) => total + line.length + 1, 0);
  return Math.min(before + parsed.column - 1, before + lines[parsed.line - 1].length);
}

function createTextareaEditor(textarea) {
  return {
    getValue: () => textarea.value,
    setValue: (value) => {
      textarea.value = String(value || "");
    },
    onChange: (listener) => textarea.addEventListener("input", listener),
    onKeydown: (listener) => textarea.addEventListener("keydown", listener),
    onCursorActivity: (listener) => {
      const notify = () => {
        const before = textarea.value.slice(0, textarea.selectionStart || 0).split("\n");
        listener({ line: before.length, column: before.at(-1).length + 1 });
      };
      textarea.addEventListener("keyup", notify);
      textarea.addEventListener("click", notify);
    },
    focusLocation: (location) => {
      const offset = nativeOffset(textarea.value, location);
      if (offset === null) return;
      textarea.focus();
      textarea.setSelectionRange(offset, offset);
      const line = parseEditorLocation(location)?.line || 1;
      const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 20;
      textarea.scrollTop = Math.max(0, (line - 3) * lineHeight);
    },
    setDiagnostics: () => {},
    refresh: () => {}
  };
}

export function createTikzEditor(textarea) {
  const CodeMirror = typeof window === "undefined"
    ? null
    : window.wp?.CodeMirror || window.CodeMirror;
  if (!CodeMirror) return createTextareaEditor(textarea);
  defineTikzMode(CodeMirror);

  let muted = 0;
  const markedLines = new Map();
  const editor = CodeMirror.fromTextArea(textarea, {
    mode: "tikzkit",
    lineNumbers: true,
    lineWrapping: false,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    matchBrackets: true,
    gutters: ["CodeMirror-linenumbers", "tikzkit-diagnostics-gutter"],
    viewportMargin: 12
  });
  editor.getWrapperElement().classList.add("tikz-code-editor");

  return {
    getValue: () => editor.getValue(),
    setValue: (value, { silent = false } = {}) => {
      const next = String(value || "");
      if (next === editor.getValue()) return;
      if (silent) muted += 1;
      editor.setValue(next);
      if (silent) muted -= 1;
    },
    onChange: (listener) => editor.on("change", () => {
      if (!muted) listener();
    }),
    onKeydown: (listener) => editor.on("keydown", (_instance, event) => listener(event)),
    onCursorActivity: (listener) => editor.on("cursorActivity", () => {
      const cursor = editor.getCursor();
      listener({ line: cursor.line + 1, column: cursor.ch + 1 });
    }),
    focusLocation: (location) => {
      const parsed = parseEditorLocation(location);
      if (!parsed) return;
      const line = Math.min(parsed.line - 1, Math.max(0, editor.lineCount() - 1));
      const ch = Math.min(parsed.column - 1, editor.getLine(line).length);
      const position = { line, ch };
      editor.focus();
      editor.setCursor(position);
      editor.scrollIntoView({ from: position, to: position }, 96);
    },
    setDiagnostics: (rows) => {
      for (const [line, severity] of markedLines) {
        editor.setGutterMarker(line, "tikzkit-diagnostics-gutter", null);
        editor.removeLineClass(line, "background", `tikz-editor-line-${severity}`);
      }
      markedLines.clear();
      for (const [oneBasedLine, entry] of diagnosticGroups(rows)) {
        const line = oneBasedLine - 1;
        if (line < 0 || line >= editor.lineCount()) continue;
        editor.setGutterMarker(line, "tikzkit-diagnostics-gutter", editorMarker(entry.severity, entry.messages));
        editor.addLineClass(line, "background", `tikz-editor-line-${entry.severity}`);
        markedLines.set(line, entry.severity);
      }
    },
    refresh: () => editor.refresh()
  };
}
