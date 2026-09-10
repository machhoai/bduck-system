const CODE39_PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

export interface BarcodeBar {
  x: number;
  width: number;
}

export function encodeCode39(value: string): {
  bars: BarcodeBar[];
  width: number;
} {
  const encoded = `*${value.toUpperCase()}*`;
  const bars: BarcodeBar[] = [];
  let x = 0;
  for (const [characterIndex, character] of Array.from(encoded).entries()) {
    const pattern = CODE39_PATTERNS[character];
    if (!pattern) {
      throw new Error(`Mã đơn chứa ký tự không hỗ trợ: ${character}`);
    }
    for (const [index, widthKind] of Array.from(pattern).entries()) {
      const width = widthKind === "w" ? 3 : 1;
      if (index % 2 === 0) bars.push({ x, width });
      x += width;
    }
    if (characterIndex < encoded.length - 1) x += 1;
  }
  return { bars, width: x };
}
