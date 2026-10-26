import { UNTITLED_CHARACTER, type Character } from "@/lib/character-doc";

/** A seat at the table as the TL and players see it (SeatInfo in lib/tables.ts). */
export type Seat = { id: string; name: string; characterId: string | null };

/**
 * At an open table the seats ("Mara (Jo)"), else the cast. Ids are seat ids at a table,
 * character ids rehearsing.
 */
export function tableSubjects(seats: readonly Seat[] | null, cast: readonly Character[]): Character[] {
  if (!seats) return [...cast];
  return seats.map((seat) => {
    const character = cast.find((c) => c.id === seat.characterId);
    if (character) {
      return { ...character, id: seat.id, portrait: null, name: `${character.name.trim() || UNTITLED_CHARACTER} (${seat.name})` };
    }
    return { id: seat.id, name: seat.name, notes: "", portrait: null, artwork: null, fields: [], campaigns: [] };
  });
}

export type SeatView = { id: string; player: string; character: Character | null };

export function seatViews(seats: readonly Seat[], cast: readonly Character[]): SeatView[] {
  return seats.map((seat) => ({
    id: seat.id,
    player: seat.name,
    character: cast.find((c) => c.id === seat.characterId) ?? null,
  }));
}
