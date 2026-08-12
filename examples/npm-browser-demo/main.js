import { splitTikzCodeBlocks, tikzToSvgAsync } from "@gezhi-io/tikzkit";

const markdown = [
  "# Markdown with TikZ",
  "",
  "The surrounding Markdown can be rendered by any Markdown library. This demo",
  "keeps it as plain text and turns each fenced TikZ block into SVG.",
  "",
  "```tikz",
  String.raw`\begin{tikzpicture}
  \draw[-stealth, thick, blue] (0,0) -- (2.4,0) node[right] {$x$};
  \draw[-stealth, thick, red] (0,0) -- (0,1.6) node[above] {$y$};
  \fill[orange] (1.2,.8) circle (2pt) node[above right] {$P$};
\end{tikzpicture}`,
  "```",
].join("\n");

const output = document.querySelector("#output");

for (const part of splitTikzCodeBlocks(markdown)) {
  if (part.type === "text") {
    const text = document.createElement("pre");
    text.className = "markdown-text";
    text.textContent = part.content.trim();
    output.append(text);
    continue;
  }

  const section = document.createElement("section");
  section.className = "tikz-render";
  const result = await tikzToSvgAsync(part.content);
  section.innerHTML = result.svg;

  if (result.diagnostics.length) {
    const diagnostics = document.createElement("pre");
    diagnostics.className = "diagnostics";
    diagnostics.textContent = result.diagnostics.map((entry) => entry.message).join("\n");
    section.append(diagnostics);
  }

  output.append(section);
}
