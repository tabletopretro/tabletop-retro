import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { characterForOwner, readCharacter } from "@/lib/characters";
import { CharacterPage } from "./character-page";

export async function generateMetadata({ params }: PageProps<"/library/characters/[id]">) {
  const user = await requireUser();
  const character = characterForOwner((await params).id, user.id);
  return { title: `${character?.name.trim() || "Character"} · Tabletop Retro` };
}

/** Someone else's id 404s, like campaigns, so ids can't be probed. */
export default async function LibraryCharacterPage({ params }: PageProps<"/library/characters/[id]">) {
  const user = await requireUser();
  const character = characterForOwner((await params).id, user.id);
  if (!character) notFound();
  return <CharacterPage initialCharacter={readCharacter(character)} />;
}
