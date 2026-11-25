export function tokenizeTikzLikeSource(source, { texTrivia = false } = {}) {
  const tokens = [];
  const text = String(source || "");
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (texTrivia && char === "%") {
      const start = index++;
      while (index < text.length && !/[\r\n]/.test(text[index])) index++;
      tokens.push({ type: "comment", value: text.slice(start, index), start, end: index });
      continue;
    }
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
      if (texTrivia && text.slice(start, index) === "\\verb") {
        if (text[index] === "*") index++;
        const delimiter = text[index];
        if (delimiter && !/[\r\n]/.test(delimiter)) {
          index++;
          while (index < text.length && !/[\r\n]/.test(text[index]) && text[index] !== delimiter) index++;
          if (text[index] === delimiter) index++;
        }
        tokens.push({ type: "literal", value: text.slice(start, index), start, end: index });
        continue;
      }
      tokens.push({ type: "control", value: text.slice(start, index), start, end: index });
      continue;
    }
    if ("{}[]();,=".includes(char)) {
      tokens.push({ type: "punct", value: char, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    const start = index;
    while (index < text.length && !/\s/.test(text[index]) && text[index] !== "\\" &&
           !"{}[]();,=".includes(text[index]) && !(texTrivia && text[index] === "%")) {
      index += 1;
    }
    tokens.push({ type: "word", value: text.slice(start, index), start, end: index });
  }
  return tokens;
}
