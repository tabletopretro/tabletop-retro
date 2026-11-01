"use client";

import { SearchIcon } from "../icons";
import styles from "./character.module.css";

/** Below this many characters a list is short enough to scan; no search field. */
export const SEARCH_FROM = 7;

/** Names compare without case, accents, apostrophes or spaces: "jihnjaar" finds Jihn'jaar. */
function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function matchesName(name: string, query: string) {
  const q = fold(query);
  return q === "" || fold(name).includes(q);
}

/** Players' characters first, then NPCs; each group keeps its order. */
export function byRole<T extends { npc: boolean }>(list: readonly T[]): T[] {
  return [...list.filter((c) => !c.npc), ...list.filter((c) => c.npc)];
}

export function byName(a: { name: string }, b: { name: string }) {
  return a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" });
}

/** An input field for narrowing a character list. Enter takes the first match. */
export function CharacterSearch({
  value,
  onChange,
  onPickFirst,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onPickFirst?: () => void;
  placeholder: string;
}) {
  return (
    <label className={styles.search}>
      <SearchIcon size={14} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onPickFirst) {
            event.preventDefault();
            onPickFirst();
          } else if (event.key === "Escape" && value) {
            event.stopPropagation();
            onChange("");
          }
        }}
      />
    </label>
  );
}
