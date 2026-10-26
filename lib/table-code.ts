/** Codes are generated freely; uniqueness is checked once, on claim, by the unique index. */
export const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_DIGITS = "23456789";
export const TABLE_CODE_PATTERN = /^[A-HJKMNP-Z]{5}-[2-9]{3}$/;
export const TABLE_CODE_EXAMPLE = "KQXMB-274";

/** Short on purpose: it only has to catch the obvious; a TL can always roll a new code. */
const BLOCKED = ["ASS", "CUNT", "DICK", "FUCK", "FUK", "NAZI", "NGGR", "PENS", "PUSSY", "RAPE", "SEX", "SHT", "SUCK", "TWAT", "WANK", "XXX"];

function pick(alphabet: string, count: number) {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  // 256 isn't a multiple of 23, so there's a sliver of bias; irrelevant for codes.
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function generateTableCode(): string {
  for (;;) {
    const letters = pick(CODE_LETTERS, 5);
    if (!BLOCKED.some((word) => letters.includes(word))) return `${letters}-${pick(CODE_DIGITS, 3)}`;
  }
}

/** Case, spaces and a missing hyphen are all accepted; null when what's left can't be a code. */
export function normalizeTableCode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length !== 8) return null;
  const code = `${compact.slice(0, 5)}-${compact.slice(5)}`;
  return TABLE_CODE_PATTERN.test(code) ? code : null;
}
