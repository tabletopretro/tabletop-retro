"use client";

import Link from "next/link";
import { type DragEvent, useState, useTransition } from "react";
import { IMAGE_MAX_BYTES, IMAGE_TYPES } from "@/lib/campaign-doc";
import {
  CHARACTER_ICONS,
  CHARACTER_LIMITS,
  characterNameError,
  characterVoicedBy,
  normalizeCharacterName,
  setCharacterVoicedBy,
  UNTITLED_CHARACTER,
  VOICED_BY_FIELD,
  type Character,
  type CharacterField,
  type CharacterImageField,
  type CharacterPatch,
} from "@/lib/character-doc";
import editor from "../campaigns/[id]/editor.module.css";
import { ACCEPT } from "../campaigns/[id]/page-editor";
import { CheckIcon, CloseIcon, PencilIcon, PlusIcon, TrashIcon, UploadIcon } from "../icons";
import { PrivateHint } from "../private-hint";
import { Tooltip } from "../tooltip";
import { removeCharacterImageAction, uploadCharacterImageAction } from "./actions";
import { CHARACTER_ICON_COMPONENTS, CharacterPortrait } from "./character-portrait";
import styles from "./character.module.css";

/** Saves to the library directly, outside any campaign's undo: a character is shared. */
export function CharacterEditor({
  character,
  campaignId,
  voiceOptions = [],
  onRename,
  onChange,
  onReplaced,
  onRemove,
  onDelete,
}: {
  character: Character;
  /** The campaign it was opened from; absent in the library. */
  campaignId?: string;
  /** Human names an NPC can be voiced by. */
  voiceOptions?: string[];
  /** Resolves to an error message, or null. */
  onRename: (name: string) => Promise<string | null>;
  onChange: (patch: Omit<CharacterPatch, "name">) => void;
  onReplaced: (character: Character) => void;
  /** Removes from this campaign's cast (undoable); only when opened from a campaign. */
  onRemove?: () => void;
  onDelete: () => void;
}) {
  const portrait = useCharacterImage(character.id, "portrait", onReplaced);
  const artwork = useCharacterImage(character.id, "artwork", onReplaced);
  const elsewhere = character.campaigns.filter((c) => c.id !== campaignId);
  const voicedBy = characterVoicedBy(character);
  // "Voiced by" is a custom field under the hood, but has its own control.
  const customFields = character.fields.filter((field) => field.label.trim().toLocaleLowerCase() !== VOICED_BY_FIELD.toLocaleLowerCase());
  const voiceChoices = [...new Set(["Table Lead", voicedBy, ...voiceOptions].map((option) => option.trim()).filter(Boolean))];

  return (
    <article className={editor.pageEditor}>
      <header className={styles.head}>
        <NameField key={character.id} name={character.name} onRename={onRename} />
        <Tooltip content="Played by you, not a player; listed after the player characters" side="bottom">
          <button
            type="button"
            role="switch"
            aria-checked={character.npc}
            className={styles.npcToggle}
            onClick={() => onChange({ npc: !character.npc, fields: character.npc ? setCharacterVoicedBy(character.fields, "") : character.fields })}
          >
            NPC
            <span className={styles.npcSwitch} aria-hidden />
          </button>
        </Tooltip>
        {onRemove ? (
          <Tooltip content="⌘Z brings them back" side="bottom">
            <button type="button" className={editor.toolButton} onClick={onRemove}>
              Remove from campaign
            </button>
          </Tooltip>
        ) : null}
      </header>

      <div className={styles.sheet}>
        <div
          className={styles.portraitColumn}
          data-dragging={portrait.dragging ? "" : undefined}
          {...portrait.dropHandlers}
        >
          <CharacterPortrait character={character} size={200} />
          {character.portrait ? (
            <div className={styles.imageTools}>
              <button type="button" className={editor.toolButton} disabled={portrait.busy} onClick={portrait.pick}>
                {portrait.busy ? "Uploading…" : "Replace"}
              </button>
              <button type="button" className={editor.toolButton} disabled={portrait.busy} onClick={portrait.remove}>
                Remove
              </button>
            </div>
          ) : (
            <>
              <button type="button" className={styles.upload} disabled={portrait.busy} onClick={portrait.pick}>
                <UploadIcon size={18} />
                {portrait.busy ? "Uploading…" : "Upload an image"}
              </button>
              {/* NPCs are an image or their initial; the icons are for players' characters. */}
              {character.npc ? null : (
                <div className={styles.iconPicker} role="radiogroup" aria-label="Or pick an icon">
                  <Tooltip content="First letter">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={character.icon === null}
                      aria-label="First letter of the name"
                      className={styles.iconChoice}
                      onClick={() => onChange({ icon: null })}
                    >
                      <span className={styles.iconLetter}>
                        {character.name.trim().charAt(0).toLocaleUpperCase() || "A"}
                      </span>
                    </button>
                  </Tooltip>
                  {CHARACTER_ICONS.map(({ id, label: iconLabel }) => {
                    const Icon = CHARACTER_ICON_COMPONENTS[id];
                    return (
                      <Tooltip key={id} content={iconLabel}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={character.icon === id}
                          aria-label={iconLabel}
                          className={styles.iconChoice}
                          onClick={() => onChange({ icon: id })}
                        >
                          <Icon size={24} />
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {portrait.picker}
          {portrait.error ? (
            <p className={editor.fieldError} role="alert">
              {portrait.error}
            </p>
          ) : null}
        </div>

        <div className={styles.fields}>
          <section
            className={styles.artwork}
            aria-label="Artwork"
            data-dragging={artwork.dragging ? "" : undefined}
            {...artwork.dropHandlers}
          >
            {character.artwork ? (
              <>
                <div className={editor.notesLabel}>
                  <span className={editor.eyebrow}>Artwork</span>
                </div>
                {/* Owner-only route: next/image would proxy it without the session. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/characters/${character.id}/images/${character.artwork}`}
                  alt=""
                  className={styles.artworkImage}
                />
                <div className={styles.imageTools}>
                  <button type="button" className={editor.toolButton} disabled={artwork.busy} onClick={artwork.pick}>
                    {artwork.busy ? "Uploading…" : "Replace"}
                  </button>
                  <button type="button" className={editor.toolButton} disabled={artwork.busy} onClick={artwork.remove}>
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className={editor.addElement} disabled={artwork.busy} onClick={artwork.pick}>
                <PlusIcon size={16} />
                {artwork.busy ? "Uploading…" : "Artwork"}
              </button>
            )}
            {artwork.picker}
            {artwork.error ? (
              <p className={editor.fieldError} role="alert">
                {artwork.error}
              </p>
            ) : null}
          </section>

          {character.npc ? (
            <label className={styles.voicedBy}>
              <span className={editor.eyebrow}>Voiced by</span>
              <select
                className={styles.fieldValue}
                value={voicedBy}
                onChange={(event) => onChange({ fields: setCharacterVoicedBy(character.fields, event.target.value) })}
              >
                <option value="">Unassigned</option>
                {voiceChoices.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <CustomFields
            fields={customFields}
            onChange={(fields) => onChange({ fields: voicedBy ? setCharacterVoicedBy(fields, voicedBy) : fields })}
          />

          <section className={editor.notesBlock}>
            <div className={editor.notesLabel}>
              <label className={editor.eyebrow} htmlFor={`character-notes-${character.id}`}>
                Notes
              </label>
              <PrivateHint />
            </div>
            <textarea
              id={`character-notes-${character.id}`}
              className={editor.notes}
              value={character.notes}
              maxLength={CHARACTER_LIMITS.notesLength}
              placeholder="Who they are, how they talk"
              rows={4}
              onChange={(event) => onChange({ notes: event.target.value })}
            />
          </section>
        </div>
      </div>

      {elsewhere.length > 0 || !campaignId ? (
        <section className={styles.campaigns} aria-labelledby={`campaigns-${character.id}`}>
          <h3 id={`campaigns-${character.id}`} className={editor.eyebrow}>
            {campaignId ? "Also in" : "Campaigns"}
          </h3>
          {elsewhere.length > 0 ? (
            <ul className={styles.campaignList}>
              {elsewhere.map((c) => (
                <li key={c.id}>
                  <Link href={`/campaigns/${c.id}`} className={styles.campaignCard}>
                    <span className={styles.deleteCover} aria-hidden>
                      {c.title.charAt(0).toUpperCase()}
                    </span>
                    <span className={styles.deleteTitle}>{c.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.campaignsEmpty}>Not in any campaign yet</p>
          )}
        </section>
      ) : null}

      <footer className={styles.dangerZone}>
        <button type="button" className={styles.deleteButton} onClick={onDelete}>
          <TrashIcon size={16} />
          Delete character
        </button>
      </footer>
    </article>
  );
}

function CustomFields({
  fields,
  onChange,
}: {
  fields: CharacterField[];
  onChange: (fields: CharacterField[]) => void;
}) {
  const set = (index: number, patch: Partial<CharacterField>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  return (
    <section className={styles.customFields} aria-label="Details">
      {fields.length > 0 ? (
        <div className={styles.fieldRows}>
          {fields.map((field, index) => (
            <div key={index} className={styles.fieldRow}>
              <input
                className={styles.fieldLabel}
                value={field.label}
                maxLength={CHARACTER_LIMITS.fieldLabelLength}
                placeholder="Label"
                aria-label={`Field ${index + 1} label`}
                autoFocus={field.label === "" && field.value === "" && index === fields.length - 1}
                onChange={(event) => set(index, { label: event.target.value })}
              />
              <input
                className={styles.fieldValue}
                value={field.value}
                maxLength={CHARACTER_LIMITS.fieldValueLength}
                placeholder="Value"
                aria-label={`Field ${index + 1} value`}
                onChange={(event) => set(index, { value: event.target.value })}
              />
              <Tooltip content="Remove field">
                <button
                  type="button"
                  className={styles.fieldRemove}
                  aria-label={`Remove field ${index + 1}`}
                  onClick={() => onChange(fields.filter((_, i) => i !== index))}
                >
                  <CloseIcon size={14} />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      ) : null}
      {fields.length < CHARACTER_LIMITS.fields ? (
        <button
          type="button"
          className={editor.addElement}
          onClick={() => onChange([...fields, { label: "", value: "" }])}
        >
          <PlusIcon size={16} />
          Field
        </button>
      ) : null}
    </section>
  );
}

/**
 * The name has its own edit and save rather than saving as you type: it's the
 * one field every campaign shows, so a rename is deliberate.
 */
function NameField({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const shown = name.trim();

  function open() {
    setDraft(name);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setDraft(name);
    setError(null);
    setEditing(false);
  }

  function save() {
    const next = normalizeCharacterName(draft);
    if (next === name) return setEditing(false);
    const invalid = characterNameError(next);
    if (invalid) return setError(invalid);
    startSaving(async () => {
      const failed = await onRename(next);
      if (failed) setError(failed);
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className={styles.nameRow}>
        <h2 className={styles.name} data-empty={shown ? undefined : ""} onDoubleClick={open}>
          {shown || UNTITLED_CHARACTER}
        </h2>
        <Tooltip content="Rename" side="bottom">
          <button type="button" className={styles.nameEdit} aria-label="Rename character" onClick={open}>
            <PencilIcon size={18} />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <form
      className={styles.nameRow}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <input
        className={`${styles.name} ${styles.nameInput}`}
        value={draft}
        maxLength={CHARACTER_LIMITS.nameLength}
        placeholder="Character name"
        aria-label="Character name"
        aria-invalid={error ? true : undefined}
        autoFocus
        readOnly={saving}
        onFocus={(event) => {
          const end = event.currentTarget.value.length;
          event.currentTarget.setSelectionRange(end, end);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
      />
      <Tooltip content="Save · Enter" side="bottom">
        <button type="submit" className={styles.nameAction} data-save="" disabled={saving} aria-label="Save name">
          <CheckIcon size={18} />
        </button>
      </Tooltip>
      <Tooltip content="Cancel · Esc" side="bottom">
        <button type="button" className={styles.nameAction} disabled={saving} aria-label="Cancel" onClick={cancel}>
          <CloseIcon size={18} />
        </button>
      </Tooltip>
      {error ? (
        <p className={`${editor.fieldError} ${styles.nameError}`} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function useCharacterImage(
  characterId: string,
  field: CharacterImageField,
  onReplaced: (character: Character) => void,
) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `${field}-${characterId}`;

  async function run(work: () => ReturnType<typeof removeCharacterImageAction>) {
    setError(null);
    setBusy(true);
    try {
      const result = await work();
      if (result.ok) onReplaced(result.character);
      else setError(result.error);
    } catch {
      setError("That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function upload(file: File) {
    if (!(file.type in IMAGE_TYPES)) return setError("Use a WebP, PNG, JPEG or GIF");
    if (file.size > IMAGE_MAX_BYTES) return setError("Images can be up to 5 MB");
    const body = new FormData();
    body.set("image", file);
    void run(() => uploadCharacterImageAction(characterId, field, body));
  }

  return {
    busy,
    dragging,
    error,
    pick: () => document.getElementById(inputId)?.click(),
    remove: () => void run(() => removeCharacterImageAction(characterId, field)),
    picker: (
      <input
        id={inputId}
        type="file"
        accept={ACCEPT}
        className={editor.srOnly}
        tabIndex={-1}
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) upload(file);
        }}
      />
    ),
    dropHandlers: {
      onDragOver: (event: DragEvent) => {
        if (!event.dataTransfer.types.includes("Files") || busy) return;
        event.preventDefault();
        // Only the drop zone under the pointer lights up, not the one beside it.
        event.stopPropagation();
        setDragging(true);
      },
      onDragLeave: (event: DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      },
      onDrop: (event: DragEvent) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.stopPropagation();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) upload(file);
      },
    },
  };
}
