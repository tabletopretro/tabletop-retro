import { DieIcon } from "@/app/icons";
import { defineActivity, type ActivityConfig } from "../types";
import { DiceEditor } from "./editor";
import { DiceStage } from "./stage";
import { DicePlay } from "./play";
import { DiceControls } from "./controls";
import type { DiceTurn } from "./turns";
import type { DiceStyle } from "./d20";

export type DiceConfig = ActivityConfig & { type: "dice" };

export type { DiceStyle } from "./d20";

export const dice = defineActivity<DiceConfig, DiceTurn | null>({
  id: "dice",
  name: "D20 Dice Roll",
  blurb: "Roll the twenty-sided die for one player, a few, or a random pick.",
  Icon: DieIcon,
  timed: false,
  settings: [
    {
      key: "dice",
      label: "Dice",
      // The looks rune-d20.js ships with, by its own names.
      options: [
        { value: "rune", label: "Rune" },
        { value: "scifi", label: "Sci-fi" },
        { value: "steampunk", label: "Steampunk" },
        { value: "nature", label: "Nature" },
      ],
    },
  ],
  make: () => ({}),
  parse: () => ({}),
  hasContent: () => false,
  Editor: DiceEditor,
  Stage: DiceStage,
  Play: DicePlay,
  Controls: DiceControls,
});

export const diceStyleOf = (config: DiceConfig) => config.settings.dice as DiceStyle;
