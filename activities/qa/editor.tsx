"use client";

import { Tooltip } from "@/app/tooltip";
import type { EditorProps } from "../types";
import { CheckOption, PromptField } from "../kit/editor";
import { QA_PROMPT_MAX, type QaConfig } from "./definition";

export function QaEditor({ config, onType, onEdit }: EditorProps<QaConfig>) {
  return (
    <>
      <PromptField
        value={config.prompt}
        max={QA_PROMPT_MAX}
        placeholder="Ask the table something, like “What should we stop doing?”"
        onChange={(prompt) => onType({ ...config, prompt })}
      />
      <Tooltip content="Nobody, you included, sees who wrote what">
        <CheckOption
          checked={config.anonymous}
          label="Anonymous answers"
          onChange={(anonymous) => onEdit({ ...config, anonymous })}
        />
      </Tooltip>
    </>
  );
}
