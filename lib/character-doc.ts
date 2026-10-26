/**
 * Shared by client and server: no Node APIs. References keep a character's id when it
 * leaves the cast or is deleted; never drop them.
 */

export const CHARACTER_LIMITS = {
  nameLength: 60,
  notesLength: 2000,
  fields: 20,
  fieldLabelLength: 40,
  fieldValueLength: 200,
  /** Per owner: a guard against runaway creation, not a product limit. */
  perOwner: 500,
} as const;

/** Server-generated UUIDs, the only ids a cast or reference may hold. */
export const CHARACTER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type Character = {
  id: string;
  name: string;
  /** TL only; never sent to players. */
  notes: string;
  /** A generated image file name, or null; without one the portrait is the name's first letter. */
  portrait: string | null;
  artwork: string | null;
  fields: CharacterField[];
  campaigns: { id: string; title: string }[];
};

export type CharacterField = { label: string; value: string };

/** Null if anything is off; the input may be hostile. */
export function parseCharacterFields(raw: unknown): CharacterField[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > CHARACTER_LIMITS.fields) return null;
  const fields: CharacterField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { label, value } = item as Record<string, unknown>;
    if (typeof label !== "string" || label.length > CHARACTER_LIMITS.fieldLabelLength) return null;
    if (typeof value !== "string" || value.length > CHARACTER_LIMITS.fieldValueLength) return null;
    fields.push({ label, value });
  }
  return fields;
}

export type CharacterImageField = "portrait" | "artwork";

export type CharacterPatch = Partial<Pick<Character, "name" | "notes" | "fields">>;

/** What a reference to a character outside the cast, or deleted, reads as. */
export const UNNAMED_CHARACTER = "Unnamed character";

/** A character in the cast with no name yet (not the same as unnamed). */
export const UNTITLED_CHARACTER = "Untitled character";

export const normalizeCharacterName = (name: string) => name.replace(/\s+/g, " ").trim();

/** Why a name can't be used (blank or a stand-in), or null. */
export function characterNameError(name: string): string | null {
  const clean = normalizeCharacterName(name);
  if (clean === "") return "Give them a name";
  if (clean.length > CHARACTER_LIMITS.nameLength) return `Names can be up to ${CHARACTER_LIMITS.nameLength} characters`;
  const lower = clean.toLocaleLowerCase();
  if (lower === UNTITLED_CHARACTER.toLocaleLowerCase() || lower === UNNAMED_CHARACTER.toLocaleLowerCase()) {
    return `“${clean}” is reserved; pick a real name`;
  }
  return null;
}

export const characterSelection = (characterId: string) => `character:${characterId}`;
export const characterSelectionId = (selection: string | null) =>
  selection?.startsWith("character:") ? selection.slice("character:".length) : null;

/** The characters a campaign's cast resolves to, in cast order. Unknown ids drop out. */
export function castMembers(cast: readonly string[], library: readonly Character[]) {
  const byId = new Map(library.map((c) => [c.id, c]));
  return cast.flatMap((id) => byId.get(id) ?? []);
}
