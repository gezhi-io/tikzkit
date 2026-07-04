export function tokenizeTikzLikeSource(source) {
  const tokens = [];
  const text = String(source || "");
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      const start = index;
      while (index < text.length && /\s/.test(text[index])) index += 1;
      tokens.push({ type: "space", value: text.slice(start, index), start, end: index });
      continue;
    }
    if (char === "\\") {
      const start = index;
      index += 1;
      while (index < text.length && /[A-Za-z@]/.test(text[index])) index += 1;
      if (index === start + 1 && index < text.length) index += 1;
      tokens.push({ type: "control", value: text.slice(start, index), start, end: index });
      continue;
    }
    if ("{}[]();,=".includes(char)) {
      tokens.push({ type: "punct", value: char, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    const start = index;
    while (index < text.length && !/\s/.test(text[index]) && text[index] !== "\\" && !"{}[]();,=".includes(text[index])) {
      index += 1;
    }
    tokens.push({ type: "word", value: text.slice(start, index), start, end: index });
  }
  return tokens;
}
