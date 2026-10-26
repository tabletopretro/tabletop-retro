import "server-only";
import { mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, count, eq, inArray } from "drizzle-orm";
import { CONTENT_DIR, db, schema } from "@/db";
import { IMAGE_NAME_PATTERN } from "./campaign-doc";
import {
  CHARACTER_ID_PATTERN,
  CHARACTER_LIMITS,
  characterNameError,
  normalizeCharacterName,
  parseCharacterFields,
  type Character,
  type CharacterImageField,
  type CharacterPatch,
} from "./character-doc";

/** Every function takes an owner id and never reaches past it; callers establish who that is. */
export const CHARACTERS_DIR = path.join(CONTENT_DIR, "characters");

/** The folder name is the character's generated UUID, never user input. */
const folderFor = (characterId: string) => path.join(CHARACTERS_DIR, characterId);

type Row = typeof schema.characters.$inferSelect;

function toCharacter(row: Row, campaigns: Character["campaigns"]): Character {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    portrait: row.portrait,
    artwork: row.artwork,
    fields: parseCharacterFields(row.fields) ?? [],
    campaigns,
  };
}

export function listCharacters(ownerId: string): Character[] {
  const rows = db
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.ownerId, ownerId))
    .orderBy(schema.characters.createdAt)
    .all();
  if (rows.length === 0) return [];
  const uses = db
    .select({
      characterId: schema.campaignCharacters.characterId,
      id: schema.campaigns.id,
      title: schema.campaigns.title,
    })
    .from(schema.campaignCharacters)
    .innerJoin(schema.campaigns, eq(schema.campaigns.id, schema.campaignCharacters.campaignId))
    .where(eq(schema.campaigns.ownerId, ownerId))
    .orderBy(schema.campaigns.title)
    .all();
  return rows.map((row) =>
    toCharacter(
      row,
      uses.filter((u) => u.characterId === row.id).map(({ id, title }) => ({ id, title })),
    ),
  );
}

export function characterForOwner(characterId: unknown, ownerId: string) {
  if (typeof characterId !== "string" || !CHARACTER_ID_PATTERN.test(characterId)) return null;
  return (
    db
      .select()
      .from(schema.characters)
      .where(and(eq(schema.characters.id, characterId), eq(schema.characters.ownerId, ownerId)))
      .get() ?? null
  );
}

export type OwnedCharacter = NonNullable<ReturnType<typeof characterForOwner>>;

export function readCharacter(character: OwnedCharacter): Character {
  const campaigns = db
    .select({ id: schema.campaigns.id, title: schema.campaigns.title })
    .from(schema.campaignCharacters)
    .innerJoin(schema.campaigns, eq(schema.campaigns.id, schema.campaignCharacters.campaignId))
    .where(eq(schema.campaignCharacters.characterId, character.id))
    .orderBy(schema.campaigns.title)
    .all();
  return toCharacter(character, campaigns);
}

export type CreateCharacterResult = { character: Character } | { error: "full" };

/** Never stores a nameless character. */
export function createCharacter(ownerId: string, name: string): CreateCharacterResult {
  return db.transaction((tx) => {
    const owned = tx
      .select({ n: count() })
      .from(schema.characters)
      .where(eq(schema.characters.ownerId, ownerId))
      .get();
    if ((owned?.n ?? 0) >= CHARACTER_LIMITS.perOwner) return { error: "full" as const };
    const row = tx
      .insert(schema.characters)
      .values({ ownerId, name: normalizeCharacterName(name) })
      .returning()
      .get();
    return { character: toCharacter(row, []) };
  });
}

/** Fields failing their checks are ignored. */
export function updateCharacter(character: OwnedCharacter, patch: CharacterPatch) {
  const set: Partial<Row> = {};
  if (typeof patch.name === "string" && characterNameError(patch.name) === null) {
    set.name = normalizeCharacterName(patch.name);
  }
  if (typeof patch.notes === "string" && patch.notes.length <= CHARACTER_LIMITS.notesLength) {
    set.notes = patch.notes;
  }
  if (patch.fields !== undefined) {
    const fields = parseCharacterFields(patch.fields);
    if (fields) set.fields = fields;
  }
  if (Object.keys(set).length === 0) return;
  db.update(schema.characters)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(schema.characters.id, character.id))
    .run();
}

/** Old file removed at once: character images aren't in any campaign's undo history. */
export function setCharacterImage(
  character: OwnedCharacter,
  field: CharacterImageField,
  bytes: Uint8Array | null,
  ext?: string,
) {
  let name: string | null = null;
  if (bytes && ext) {
    name = `${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
    mkdirSync(folderFor(character.id), { recursive: true });
    writeFileSync(path.join(folderFor(character.id), name), bytes);
  }
  db.update(schema.characters)
    .set({ [field]: name, updatedAt: new Date() })
    .where(eq(schema.characters.id, character.id))
    .run();
  const old = character[field];
  if (old && IMAGE_NAME_PATTERN.test(old)) {
    try {
      unlinkSync(path.join(folderFor(character.id), old));
    } catch {
      // Already gone.
    }
  }
  return name;
}

/** Null for any name that isn't one of this character's current images. */
export function characterImagePath(character: OwnedCharacter, name: string) {
  if (!IMAGE_NAME_PATTERN.test(name) || (character.portrait !== name && character.artwork !== name)) return null;
  return path.join(folderFor(character.id), name);
}

/**
 * The join rows cascade. Campaign files still list the id until their
 * next save, and pages keep their references, which then read as an
 * unnamed character. Never drop a reference because its character is gone.
 */
export function deleteCharacter(character: OwnedCharacter) {
  db.delete(schema.characters).where(eq(schema.characters.id, character.id)).run();
  rmSync(folderFor(character.id), { recursive: true, force: true });
}

/**
 * A campaign's cast, cut down to characters this owner has, with the
 * join table rewritten to match. Called on every save, so a crafted
 * save can't put someone else's character in a cast.
 */
export function syncCast(campaignId: string, ownerId: string, cast: readonly string[]): string[] {
  return db.transaction((tx) => {
    const owned =
      cast.length === 0
        ? new Set<string>()
        : new Set(
            tx
              .select({ id: schema.characters.id })
              .from(schema.characters)
              .where(and(eq(schema.characters.ownerId, ownerId), inArray(schema.characters.id, [...cast])))
              .all()
              .map((row) => row.id),
          );
    const kept = cast.filter((id) => owned.has(id));
    tx.delete(schema.campaignCharacters).where(eq(schema.campaignCharacters.campaignId, campaignId)).run();
    if (kept.length > 0) {
      tx.insert(schema.campaignCharacters)
        .values(kept.map((characterId) => ({ campaignId, characterId })))
        .run();
    }
    return kept;
  });
}
