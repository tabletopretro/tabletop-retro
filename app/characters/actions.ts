"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { IMAGE_MAX_BYTES } from "@/lib/campaign-doc";
import { STORAGE_FULL, storageLeft } from "@/lib/storage";
import {
  characterNameError,
  type Character,
  type CharacterImageField,
  type CharacterPatch,
} from "@/lib/character-doc";
import { detectImageType } from "@/lib/campaigns";
import {
  characterForOwner,
  createCharacter,
  deleteCharacter,
  readCharacter,
  type OwnedCharacter,
  setCharacterImage,
  updateCharacter,
} from "@/lib/characters";

/* Every export is a public endpoint: re-check session and ownership; ids and payloads are hostile. */

async function ownedCharacter(characterId: unknown) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return characterForOwner(characterId, user.id);
}

export type CharacterState = { ok: true; character: Character } | { ok: false; error: string };

const GONE = { ok: false, error: "This character no longer exists" } as const;

function reread(character: OwnedCharacter): CharacterState {
  const fresh = characterForOwner(character.id, character.ownerId);
  return fresh ? { ok: true, character: readCharacter(fresh) } : GONE;
}

export async function createCharacterAction(name: unknown): Promise<CharacterState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (typeof name !== "string") return { ok: false, error: "Give them a name" };
  const invalid = characterNameError(name);
  if (invalid) return { ok: false, error: invalid };
  const result = createCharacter(user.id, name);
  if ("error" in result) return { ok: false, error: "You have as many characters as you can keep" };
  return { ok: true, character: result.character };
}

export async function updateCharacterAction(characterId: string, patch: unknown): Promise<CharacterState> {
  const character = await ownedCharacter(characterId);
  if (!character) return GONE;
  if (patch && typeof patch === "object") {
    const p = patch as Record<string, unknown>;
    if (typeof p.name === "string") {
      const invalid = characterNameError(p.name);
      if (invalid) return { ok: false, error: invalid };
    }
    updateCharacter(character, {
      name: typeof p.name === "string" ? p.name : undefined,
      notes: typeof p.notes === "string" ? p.notes : undefined,
      // Checked field by field in updateCharacter; anything malformed is dropped.
      fields: "fields" in p ? (p.fields as CharacterPatch["fields"]) : undefined,
    });
  }
  return reread(character);
}

const imageField = (field: unknown): CharacterImageField => (field === "artwork" ? "artwork" : "portrait");

export async function uploadCharacterImageAction(
  characterId: string,
  field: CharacterImageField,
  formData: FormData,
): Promise<CharacterState> {
  const character = await ownedCharacter(characterId);
  if (!character) return GONE;
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image" };
  if (file.size > IMAGE_MAX_BYTES) return { ok: false, error: "Images can be up to 5 MB" };
  if (file.size > storageLeft(character.ownerId)) return { ok: false, error: STORAGE_FULL };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectImageType(bytes);
  if (!ext) return { ok: false, error: "Use a WebP, PNG, JPEG or GIF" };
  setCharacterImage(character, imageField(field), bytes, ext);
  return reread(character);
}

export async function removeCharacterImageAction(
  characterId: string,
  field: CharacterImageField,
): Promise<CharacterState> {
  const character = await ownedCharacter(characterId);
  if (!character) return GONE;
  setCharacterImage(character, imageField(field), null);
  return reread(character);
}

export type DeleteCharacterState = { ok: true } | { ok: false; error: string };

export async function deleteCharacterAction(characterId: string): Promise<DeleteCharacterState> {
  const character = await ownedCharacter(characterId);
  if (!character) return { ok: true };
  deleteCharacter(character);
  return { ok: true };
}
