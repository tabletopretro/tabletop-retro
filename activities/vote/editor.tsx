"use client";

import { Tooltip } from "@/app/tooltip";
import type { EditorProps } from "../types";
import { CheckOption, OptionList, PromptField } from "../kit/editor";
import { VOTE_OPTION_MAX, VOTE_OPTIONS_MAX, VOTE_OPTIONS_MIN, VOTE_PROMPT_MAX, type VoteConfig } from "./definition";

export function VoteEditor({ config, onType, onEdit }: EditorProps<VoteConfig>) {
  return (
    <>
      <PromptField
        value={config.prompt}
        max={VOTE_PROMPT_MAX}
        placeholder="Ask the table to decide something, like “Which one do we fix first?”"
        onChange={(prompt) => onType({ ...config, prompt })}
      />
      <OptionList
        options={config.options}
        min={VOTE_OPTIONS_MIN}
        max={VOTE_OPTIONS_MAX}
        optionMax={VOTE_OPTION_MAX}
        onType={(options) => onType({ ...config, options })}
        onEdit={(options) => onEdit({ ...config, options })}
      />
      <Tooltip content="Nobody, you included, sees who voted for what">
        <CheckOption checked={config.anonymous} label="Anonymous votes" onChange={(anonymous) => onEdit({ ...config, anonymous })} />
      </Tooltip>
    </>
  );
}
