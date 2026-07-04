export function parseTikzCasesMarkdown(markdown) {
  const cases = [];
  const fencePattern = /```tikz\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = fencePattern.exec(markdown))) {
    const before = markdown.slice(0, match.index);
    const heading = [...before.matchAll(/^##\s+(.+)$/gm)].at(-1)?.[1]?.trim() || `case-${cases.length + 1}`;
    const { id, title } = parseCaseHeading(heading, cases.length + 1);
    cases.push({
      id,
      title,
      source: match[1].trim()
    });
  }
  return cases;
}

export function findTikzCaseIndexByHash(cases, hash) {
  const target = String(hash || "").trim().replace(/^#/, "");
  if (!target) return -1;
  return (cases || []).findIndex((item) => item?.id === target);
}

function parseCaseHeading(heading, index) {
  const parts = heading.split(/\s*:\s*/);
  const id = slug(parts[0] || `case-${index}`);
  const title = parts.slice(1).join(": ").trim() || parts[0]?.trim() || id;
  return { id, title };
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "case";
}
