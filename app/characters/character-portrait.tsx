import type { Character, CharacterIconId } from "@/lib/character-doc";
import {
  CampfireIcon,
  CandleIcon,
  CompassIcon,
  CrownIcon,
  DieIcon,
  FeatherIcon,
  KeyIcon,
  PersonIcon,
  ShieldIcon,
  StarIcon,
} from "../icons";
import styles from "./character.module.css";

export const CHARACTER_ICON_COMPONENTS: Record<CharacterIconId, typeof DieIcon> = {
  feather: FeatherIcon,
  candle: CandleIcon,
  campfire: CampfireIcon,
  die: DieIcon,
  crown: CrownIcon,
  shield: ShieldIcon,
  compass: CompassIcon,
  key: KeyIcon,
  star: StarIcon,
};

/**
 * Image, else icon, else the name's first letter. `null` is a reference
 * whose character left the cast or was deleted: a blank figure.
 */
export function CharacterPortrait({ character, size }: { character: Character | null; size: number }) {
  const box = { width: size, height: size };
  if (!character) {
    return (
      <span className={`${styles.portrait} ${styles.portraitUnnamed}`} style={box} aria-hidden>
        <PersonIcon size={Math.round(size * 0.6)} />
      </span>
    );
  }
  if (character.portrait) {
    return (
      // Owner-only route (or a seated player's, through the table) with private
      // caching; next/image would proxy it through the optimizer without the session.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={character.portraitSrc ?? `/characters/${character.id}/images/${character.portrait}`}
        alt=""
        className={styles.portrait}
        style={box}
      />
    );
  }
  // An NPC never shows an icon, even one picked before it was marked NPC.
  const Icon = character.icon && !character.npc ? CHARACTER_ICON_COMPONENTS[character.icon] : null;
  const initial = character.name.trim().charAt(0).toLocaleUpperCase();
  return (
    <span className={styles.portrait} style={{ ...box, fontSize: Math.round(size * 0.45) }} aria-hidden>
      {Icon ? <Icon size={Math.round(size * 0.6)} /> : initial || <PersonIcon size={Math.round(size * 0.6)} />}
    </span>
  );
}
