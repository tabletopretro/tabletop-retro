import type { DetailedHTMLProps, HTMLAttributes } from "react";

/** The vendored <rune-d20> custom element (rune-d20.js, beside this file). */
export interface RuneD20Element extends HTMLElement {
  /** Resolves with the face that lands. `forced` lands on that face (our patch). */
  roll(forced?: number): Promise<number>;
  value: number;
}

/** "roll-start" carries the face the roll will land on (our patch), so the table can roll it everywhere at once. */
export type RollStartEvent = CustomEvent<{ value: number }>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "rune-d20": DetailedHTMLProps<HTMLAttributes<RuneD20Element>, RuneD20Element> & {
        "dice-style"?: "rune" | "scifi" | "steampunk" | "nature";
        glow?: string;
        "hide-ui"?: "";
      };
    }
  }
}
