// ltplain.dtx: uppercase abbreviations suppress sentence spacing; closing
// punctuation with sfcode zero preserves the preceding space factor.
export function nativeSpaceFactor(previous, char) {
  if ([")", "'", "]", "\u2019", "\u201d"].includes(char)) return previous;
  const next = /[A-Z]/.test(char) ? 999
    : ({ ".": 3000, "?": 3000, "!": 3000, ":": 2000, ";": 1500, ",": 1250 }[char] || 1000);
  return next > 1000 && previous < 1000 ? 1000 : next;
}
