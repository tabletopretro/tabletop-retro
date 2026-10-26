/** Guest name rules, kept free of server imports so they can be tested on their own. */

/** Kept in step with GUEST_NAME_MAX_CLIENT in app/play/limits.ts. */
export const GUEST_NAME_MAX = 40;

/** Titles that would read as the Table Lead or as a stand-in. */
const RESERVED = new Set(["table lead", "tablelead", "tl", "player", "players"]);

export const foldName = (n: string) => n.toLocaleLowerCase().replace(/\s+/g, " ").trim();

/**
 * Control and invisible format characters stripped, whitespace collapsed,
 * at least one letter or digit, and never a reserved title or the lead's
 * own name.
 */
export function cleanGuestName(raw: string, leadName: string | null): { name: string } | { error: string } {
  const name = raw
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return { error: "Tell the table your name" };
  if (name.length > GUEST_NAME_MAX) return { error: `Names can be up to ${GUEST_NAME_MAX} characters` };
  if (!/[\p{L}\p{N}]/u.test(name)) return { error: "Use letters or numbers in your name" };
  if (RESERVED.has(foldName(name)) || (leadName && foldName(leadName) === foldName(name))) {
    return { error: "That name is taken at this table" };
  }
  return { name };
}

/** "Sam", then "Sam 2", "Sam 3": one person can't pass for another at the table. */
export function uniqueGuestName(name: string, taken: ReadonlySet<string>): string {
  let unique = name;
  for (let n = 2; taken.has(foldName(unique)); n++) {
    const suffix = ` ${n}`;
    unique = `${name.slice(0, GUEST_NAME_MAX - suffix.length)}${suffix}`;
  }
  return unique;
}
