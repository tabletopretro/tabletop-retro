"use client";

import type { ReactNode } from "react";
import { CloseIcon, PlusIcon } from "@/app/icons";
import styles from "./editor.module.css";

export function Setting({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className={styles.setting}>
      <span className={styles.eyebrow} id={id}>
        {label}
      </span>
      {children}
    </div>
  );
}

export function Segmented<T extends string | number>({
  labelledBy,
  value,
  options,
  onChange,
}: {
  labelledBy: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={styles.segment}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PromptField({
  value,
  max,
  placeholder,
  label = "Question",
  onChange,
}: {
  value: string;
  max: number;
  placeholder: string;
  label?: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      className={styles.prompt}
      value={value}
      maxLength={max}
      placeholder={placeholder}
      rows={2}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** Typing goes to `onType` (coalesced undo), adding and removing to `onEdit`. */
export function OptionList({
  options,
  min,
  max,
  optionMax,
  noun = "Option",
  onType,
  onEdit,
}: {
  options: string[];
  min: number;
  max: number;
  optionMax: number;
  noun?: string;
  onType: (options: string[]) => void;
  onEdit: (options: string[]) => void;
}) {
  const replace = (index: number, value: string) => options.map((o, i) => (i === index ? value : o));
  return (
    <div className={styles.options}>
      {options.map((option, index) => (
        <div key={index} className={styles.option}>
          <input
            className={styles.optionInput}
            value={option}
            maxLength={optionMax}
            placeholder={`${noun} ${index + 1}`}
            aria-label={`${noun} ${index + 1}`}
            onChange={(event) => onType(replace(index, event.target.value))}
          />
          {options.length > min ? (
            <button
              type="button"
              className={styles.optionRemove}
              aria-label={`Remove ${noun.toLowerCase()} ${index + 1}`}
              onClick={() => onEdit(options.filter((_, i) => i !== index))}
            >
              <CloseIcon size={14} />
            </button>
          ) : null}
        </div>
      ))}
      {options.length < max ? (
        <button type="button" className={styles.add} onClick={() => onEdit([...options, ""])}>
          <PlusIcon size={16} />
          {noun}
        </button>
      ) : null}
    </div>
  );
}

export function CheckOption({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function Rules({ children }: { children: ReactNode }) {
  return <p className={styles.rules}>{children}</p>;
}

export function Preview({ children }: { children: ReactNode }) {
  return <div className={styles.preview}>{children}</div>;
}

export function Setup({ children }: { children: ReactNode }) {
  return <div className={styles.setup}>{children}</div>;
}
