"use client";

import type { EditorProps } from "../types";
import { Preview, Rules, Setup } from "../kit/editor";
import { D20 } from "./d20";
import { diceStyleOf, type DiceConfig } from "./definition";

export function DiceEditor({ config }: EditorProps<DiceConfig>) {
  return (
    <Setup>
      <Rules>Roll the twenty-sided die for one player, a few, or a random pick. Highest goes first.</Rules>
      <Preview>
        <D20 diceStyle={diceStyleOf(config)} preview />
      </Preview>
    </Setup>
  );
}
