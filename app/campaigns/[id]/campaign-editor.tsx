"use client";

import Link from "next/link";
import {
  Activity,
  addTransitionType,
  startTransition,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
  ViewTransition,
} from "react";
import {
  blankChapter,
  blankOpener,
  blankPage,
  docImages,
  docSounds,
  docVideos,
  openerChapterId,
  openerSelection,
  type ChapterOpener,
  DOC_LIMITS,
  moveChapter,
  movePage,
  pageHasContent,
  type CampaignChapter,
  type CampaignDoc,
  type CampaignPage,
} from "@/lib/campaign-doc";
import {
  castMembers,
  CHARACTER_LIMITS,
  characterNameError,
  characterSelection,
  normalizeCharacterName,
  characterSelectionId,
  UNTITLED_CHARACTER,
  type Character,
  type CharacterPatch,
} from "@/lib/character-doc";
import {
  createCharacterAction,
  deleteCharacterAction,
  updateCharacterAction,
} from "../../characters/actions";
import {
  ActivityIcon,
  BackIcon,
  ChevronIcon,
  CloseIcon,
  GripIcon,
  ImageIcon,
  OpenerIcon,
  PlayIcon,
  PlusIcon,
  QuoteIcon,
  TrashIcon,
} from "../../icons";
import { Tooltip } from "../../tooltip";
import ui from "../../ui.module.css";
import { deleteCampaignAction, saveCampaignDocAction } from "./actions";
import { CharacterEditor } from "../../characters/character-editor";
import { DeleteCharacterBody } from "../../characters/delete-character-body";
import charStyles from "../../characters/character.module.css";
import { CharacterPortrait } from "../../characters/character-portrait";
import { ConfirmDialog } from "./confirm-dialog";
import styles from "./editor.module.css";
import { EDIT_PAGE_MOTION } from "./motion";
import { OpenerEditor } from "./opener-editor";
import { derivedLabel, EMPTY_PAGE_LABEL, pageLabel, type PageLabel } from "./page-label";
import { PageEditor } from "./page-editor";
import { slidesOf } from "./slides";
import { musicAt, musicBeforeBySlide, musicBySlide } from "./soundtrack";
import { SoundBadges } from "./sound-badges";
import { PresentView } from "./present-view";
import type { ActivityFeed, LiveActivity } from "@/activities/types";
import { PresentTableBar, SettingsDialog } from "./table-bar";
import {
  leadActivityAction,
  releaseSeatAction,
  removeSeatAction,
  restartTimerAction,
  showAnswersAction,
  setPlaybackAction,
  setSlideAction,
  type TableInfo,
} from "./table-actions";
import { TitleField } from "./title-field";

/**
 * `docRef` always holds the latest doc so async work never writes back a stale copy.
 * Only structural changes run in startTransition (that arms <ViewTransition>); typing doesn't.
 * Drags start from grips: browsers won't reliably start one from a button.
 */

const AUTOSAVE_MS = 800;

const HISTORY_LIMIT = 50;
/** Typing in one field within this long of the last keystroke is one step. */
const COALESCE_MS = 1500;

const ROW_MOTION = {
  enter: { outline: "row-in", "outline-add": "row-fade", default: "none" },
  exit: { outline: "row-out", default: "none" },
  update: { outline: "row-move", default: "none" },
} as const;

type SaveStatus = "saved" | "dirty" | "saving" | "error";

type CommitOptions = {
  types?: string[];
  select?: string | null;
  /** Edits sharing a key within COALESCE_MS are one undo step (typing). */
  key?: string;
  /** Undo and redo themselves don't add history. */
  skipHistory?: boolean;
};

function isTextField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "file"].includes(target.type);
}

/** Only ever called from event handlers, never during render. */
const clock = () => Date.now();

/** Images and videos the given docs use, so a save's prune spares what undo can bring back. */
function mediaIn(docs: CampaignDoc[]) {
  return [...new Set(docs.flatMap((d) => [...docImages(d), ...docVideos(d), ...docSounds(d)]))];
}
type PagePatch = Partial<Omit<CampaignPage, "id">>;
type Pending =
  | { kind: "campaign" }
  | { kind: "chapter"; chapter: CampaignChapter }
  | { kind: "character"; character: Character };

type Entry = { page: CampaignPage; chapter: CampaignChapter; ci: number; pi: number };

type Drag = { kind: "page" | "chapter"; id: string };
/** `key`: `page:<id>`, `chapter:<id>`, `head:<chapterId>` or `end:<chapterId>`. */
type DropMark = { key: string; where: "before" | "after" };

function isMoveKey(event: ReactKeyboardEvent) {
  return event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown");
}

function selectionExists(doc: CampaignDoc, selection: string) {
  const chapterId = openerChapterId(selection);
  if (chapterId) return doc.chapters.some((c) => c.id === chapterId && c.opener);
  const characterId = characterSelectionId(selection);
  if (characterId) return doc.cast.includes(characterId);
  return doc.chapters.some((c) => c.pages.some((p) => p.id === selection));
}

function flatten(doc: CampaignDoc): Entry[] {
  return doc.chapters.flatMap((chapter, ci) =>
    chapter.pages.map((page, pi) => ({ page, chapter, ci, pi })),
  );
}

export function CampaignEditor({
  campaignId,
  initialTitle,
  initialDoc,
  initialCharacters,
  initialTableInfo,
  initialMode = "edit",
  initialAt = null,
}: {
  campaignId: string;
  initialTitle: string;
  initialDoc: CampaignDoc;
  /** The TL's whole character library, not just this campaign's cast. */
  initialCharacters: Character[];
  initialTableInfo: TableInfo;
  initialMode?: "edit" | "present";
  /** The selection from the URL; ignored unless it names something in this campaign. */
  initialAt?: string | null;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [doc, setDoc] = useState(initialDoc);
  const musicNow = musicBySlide(slidesOf(doc));
  const musicBefore = musicBeforeBySlide(slidesOf(doc));
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialAt && selectionExists(initialDoc, initialAt) ? initialAt : (initialDoc.chapters[0]?.pages[0]?.id ?? null),
  );
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const [mode, setMode] = useState<"edit" | "present">(initialMode);

  // Replaced, not pushed, so Back still leaves the campaign.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (mode === "present") url.searchParams.set("mode", "present");
    else url.searchParams.delete("mode");
    if (selectedId) url.searchParams.set("at", selectedId);
    else url.searchParams.delete("at");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [mode, selectedId]);

  const docRef = useRef(doc);
  // Undo history: whole-document snapshots (edits share structure, so they're cheap). Session-only.
  const past = useRef<CampaignDoc[]>([]);
  const future = useRef<CampaignDoc[]>([]);
  const lastEdit = useRef<{ key: string; at: number } | null>(null);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const inFlight = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  /** Set while the campaign is being deleted; no more saves after that. */
  const closing = useRef(false);

  const drag = useRef<Drag | null>(null);
  // State drives the drop line; the ref is what the drop handler reads,
  // so it never sees a mark from a render that hasn't happened yet.
  const [dropMark, setDropMark] = useState<DropMark | null>(null);
  const dropRef = useRef<DropMark | null>(null);
  const focusAfterMove = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movedId, setMovedId] = useState<string | null>(null);
  const movedTimer = useRef<number | undefined>(undefined);
  /** Folded chapters. View state only: not saved with the campaign. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  /** Enter and blur can both end a rename; only the first one counts. */
  const renameDone = useRef(false);
  const renameOriginal = useRef("");

  /** Characters save on their own, outside this doc's ⌘Z; cast membership is a doc edit. */
  const [characters, setCharacters] = useState(initialCharacters);
  const [characterStatus, setCharacterStatus] = useState<SaveStatus>("saved");
  const characterPatches = useRef(new Map<string, CharacterPatch>());
  const characterTimer = useRef<number | undefined>(undefined);
  const characterInFlight = useRef(false);
  /** Naming a new character inline in the outline; nothing is stored until it has a name. */
  const [naming, setNaming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [castError, setCastError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [tableInfo, setTableInfo] = useState(initialTableInfo);
  const [leftAt, setLeftAt] = useState<{ table: string; slide: string } | null>(null);
  const [remoteActivity, setRemoteActivity] = useState<LiveActivity | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [castCollapsed, setCastCollapsed] = useState(false);

  const entries = flatten(doc);
  const cast = castMembers(doc.cast, characters);
  const uncast = characters.filter((c) => !doc.cast.includes(c.id));
  const openerFor = openerChapterId(selectedId);
  const openerChapter = openerFor ? (doc.chapters.find((c) => c.id === openerFor) ?? null) : null;
  const characterFor = characterSelectionId(selectedId);
  const selectedCharacter = characterFor ? (cast.find((c) => c.id === characterFor) ?? null) : null;
  const current =
    openerChapter || selectedCharacter
      ? null
      : (entries.find((e) => e.page.id === selectedId) ?? entries[0] ?? null);

  const presentSlide = openerChapter ? openerSelection(openerChapter.id) : (current?.page.id ?? null);
  const tableId = tableInfo.table?.id ?? null;

  useEffect(() => {
    if (mode !== "present" || !tableId || !presentSlide) return;
    // Best effort: a missed update is corrected by the next slide change.
    setSlideAction(campaignId, presentSlide).catch(() => undefined);
  }, [mode, tableId, presentSlide, campaignId]);

  useEffect(() => {
    if (mode !== "present" || !tableId) return;
    const feed = new EventSource(`/campaigns/${campaignId}/table-events`);
    feed.onmessage = (event) => {
      try {
        const { seats, activity } = JSON.parse(event.data) as {
          seats: TableInfo["seats"];
          activity: ActivityFeed | null;
        };
        setTableInfo((info) => ({ ...info, seats }));
        setRemoteActivity(activity ? { ...activity, receivedAt: performance.now() } : null);
      } catch {
        // A malformed message: keep the last list.
      }
    };
    return () => feed.close();
  }, [mode, tableId, campaignId]);

  async function save() {
    window.clearTimeout(timer.current);
    if (closing.current || inFlight.current) return;
    if (revision.current === savedRevision.current) return;
    const rev = revision.current;
    inFlight.current = true;
    setStatus("saving");
    let ok = false;
    try {
      // Images still reachable by undo/redo must survive the save's prune.
      const keep = mediaIn([...past.current, ...future.current]);
      const result = await saveCampaignDocAction(campaignId, docRef.current, keep);
      ok = result.ok;
      if (result.ok) savedRevision.current = rev;
      else setSaveError(result.error);
    } catch {
      setSaveError("Couldn't reach the server");
    }
    inFlight.current = false;
    if (!ok) return setStatus("error");
    setSaveError(null);
    // Edits made while this save was in flight still need their own.
    if (revision.current !== rev) void save();
    else setStatus("saved");
  }

  function record(prev: CampaignDoc, key?: string) {
    const now = clock();
    const last = lastEdit.current;
    if (key && last?.key === key && now - last.at < COALESCE_MS) {
      last.at = now;
      return;
    }
    past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), prev];
    future.current = [];
    lastEdit.current = key ? { key, at: now } : null;
  }

  function commit(next: CampaignDoc, motion: CommitOptions = {}) {
    if (!motion.skipHistory) record(docRef.current, motion.key);
    docRef.current = next;
    revision.current += 1;
    setStatus("dirty");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), AUTOSAVE_MS);

    const apply = () => {
      setDoc(next);
      if (motion.select !== undefined) setSelectedId(motion.select);
    };
    const types = motion.types ?? [];
    if (types.length === 0) return apply();
    startTransition(() => {
      for (const type of types) addTransitionType(type);
      apply();
    });
  }

  function patchCharacter(characterId: string, patch: CharacterPatch) {
    setCharacters((list) => list.map((c) => (c.id === characterId ? { ...c, ...patch } : c)));
    characterPatches.current.set(characterId, { ...characterPatches.current.get(characterId), ...patch });
    setCharacterStatus("dirty");
    window.clearTimeout(characterTimer.current);
    characterTimer.current = window.setTimeout(() => void saveCharacters(), AUTOSAVE_MS);
  }

  async function saveCharacters() {
    window.clearTimeout(characterTimer.current);
    if (closing.current || characterInFlight.current || characterPatches.current.size === 0) return;
    const batch = [...characterPatches.current];
    characterPatches.current = new Map();
    characterInFlight.current = true;
    setCharacterStatus("saving");
    let failed: string | null = null;
    for (const [id, patch] of batch) {
      try {
        const result = await updateCharacterAction(id, patch);
        if (!result.ok) failed = result.error;
      } catch {
        failed = "Couldn't reach the server";
        // Put it back under anything typed since, for the retry.
        characterPatches.current.set(id, { ...patch, ...characterPatches.current.get(id) });
      }
    }
    characterInFlight.current = false;
    if (failed) {
      setSaveError(failed);
      return setCharacterStatus("error");
    }
    if (characterPatches.current.size > 0) void saveCharacters();
    else setCharacterStatus("saved");
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void save();
      void saveCharacters();
    }
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /** One indicator for both saves: the worst state wins. */
  const shownStatus: SaveStatus = (["error", "saving", "dirty"] as const).find(
    (s) => status === s || characterStatus === s,
  ) ?? "saved";
  const dirty = shownStatus !== "saved";
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (!closing.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // In-app navigation doesn't fire beforeunload, so save on the way out.
  const flush = useEffectEvent(() => {
    void save();
    void saveCharacters();
  });
  useEffect(() => () => flush(), []);

  /** Names save at once, on their own, not with the debounced edits. */
  async function renameCharacter(characterId: string, name: string): Promise<string | null> {
    try {
      const result = await updateCharacterAction(characterId, { name });
      if (!result.ok) return result.error;
      setCharacters((list) => list.map((c) => (c.id === characterId ? { ...c, name } : c)));
      return null;
    } catch {
      return "Couldn't reach the server";
    }
  }

  function selectCharacter(characterId: string) {
    startTransition(() => {
      addTransitionType("page-next");
      setSelectedId(characterSelection(characterId));
    });
  }

  function addToCast(characterId: string) {
    const base = docRef.current;
    setLibraryOpen(false);
    if (base.cast.includes(characterId)) return selectCharacter(characterId);
    if (base.cast.length >= DOC_LIMITS.cast) return setCastError("A campaign can cast up to 100 characters");
    commit(
      { ...base, cast: [...base.cast, characterId] },
      { types: ["outline-add", "page-next"], select: characterSelection(characterId) },
    );
  }

  /** Nothing is stored or cast until the name is valid; an empty field just closes. */
  async function createCharacter(raw: string) {
    if (creating) return;
    const name = normalizeCharacterName(raw);
    if (name === "") return setNaming(false);
    const invalid = characterNameError(name);
    if (invalid) return setCastError(invalid);
    setCreating(true);
    setCastError(null);
    try {
      const result = await createCharacterAction(name);
      if (!result.ok) return setCastError(result.error);
      setCharacters((list) => [...list, result.character]);
      setNaming(false);
      addToCast(result.character.id);
    } catch {
      setCastError("Couldn't reach the server");
    } finally {
      setCreating(false);
    }
  }

  /** Out of this cast, not the library. Pages that refer to them keep the reference. */
  function removeFromCast(characterId: string) {
    const base = docRef.current;
    const next = { ...base, cast: base.cast.filter((id) => id !== characterId) };
    const select = characterFor === characterId ? (flatten(next)[0]?.page.id ?? null) : undefined;
    commit(next, { types: ["outline"], select });
  }

  function direction(next: CampaignDoc, fromId: string | undefined, toId: string) {
    const list = flatten(next);
    const from = list.findIndex((e) => e.page.id === fromId);
    const to = list.findIndex((e) => e.page.id === toId);
    return to >= from ? "page-next" : "page-prev";
  }

  const playersAt = tableId ? (leftAt?.table === tableId ? leftAt.slide : (tableInfo.table?.slide ?? null)) : null;
  const continueTo = playersAt && slidesOf(doc).some((s) => s.id === playersAt) ? playersAt : null;

  function continuePresenting() {
    if (continueTo) setSelectedId(continueTo);
    setMode("present");
  }

  function startPresenting(fromStart: boolean) {
    if (fromStart) {
      const first = doc.chapters.find((c) => c.opener || c.pages.length > 0);
      if (first) setSelectedId(first.opener ? openerSelection(first.id) : first.pages[0].id);
    }
    setMode("present");
  }

  function select(pageId: string) {
    // Coming from an opener there's no page to measure direction from.
    if (!current) {
      startTransition(() => {
        addTransitionType("page-next");
        setSelectedId(pageId);
      });
      return;
    }
    if (pageId === current.page.id) return;
    const type = direction(doc, current.page.id, pageId);
    startTransition(() => {
      addTransitionType(type);
      setSelectedId(pageId);
    });
  }

  function patchPage(pageId: string, patch: PagePatch, types?: string[]) {
    const base = docRef.current;
    // Typing coalesces per field; an image swap is a step of its own.
    const key = types?.includes("image") ? undefined : `${pageId}:${Object.keys(patch).join(",")}`;
    commit(
      {
        ...base,
        chapters: base.chapters.map((c) => ({
          ...c,
          pages: c.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
        })),
      },
      { types, key },
    );
  }

  function renameChapter(chapterId: string, chapterTitle: string) {
    const base = docRef.current;
    commit({
      ...base,
      chapters: base.chapters.map((c) => (c.id === chapterId ? { ...c, title: chapterTitle } : c)),
    }, { key: `chapter:${chapterId}` });
  }

  function addPage(chapterId: string) {
    const base = docRef.current;
    const page = blankPage();
    const next = {
      ...base,
      chapters: base.chapters.map((c) =>
        c.id === chapterId ? { ...c, pages: [...c.pages, page] } : c,
      ),
    };
    commit(next, {
      types: ["outline-add", direction(next, current?.page.id, page.id)],
      select: page.id,
    });
  }

  function addChapter() {
    const base = docRef.current;
    const chapter = blankChapter();
    const next = { ...base, chapters: [...base.chapters, chapter] };
    commit(next, { types: ["outline-add", "page-next"], select: chapter.pages[0].id });
  }

  function commitRemoval(next: CampaignDoc) {
    const remaining = flatten(next);
    if (!current || remaining.some((e) => e.page.id === current.page.id)) {
      return commit(next, { types: ["outline"] });
    }
    const oldIndex = entries.findIndex((e) => e.page.id === current.page.id);
    const kept = new Set(remaining.map((e) => e.page.id));
    const before = entries.slice(0, oldIndex).filter((e) => kept.has(e.page.id)).length;
    const after = remaining[before];
    const target = after ?? remaining[before - 1] ?? null;
    commit(next, {
      types: ["outline", after ? "page-next" : "page-prev"],
      select: target?.page.id ?? null,
    });
  }

  function removePage(pageId: string) {
    const base = docRef.current;
    commitRemoval({
      ...base,
      chapters: base.chapters.map((c) => ({ ...c, pages: c.pages.filter((p) => p.id !== pageId) })),
    });
  }

  function removeChapter(chapterId: string) {
    const base = docRef.current;
    commitRemoval({ ...base, chapters: base.chapters.filter((c) => c.id !== chapterId) });
  }

  function mark(next: DropMark | null) {
    const prev = dropRef.current;
    if (prev?.key === next?.key && prev?.where === next?.where) return;
    dropRef.current = next;
    setDropMark(next);
  }

  function markOf(key: string) {
    return dropMark?.key === key ? dropMark.where : undefined;
  }

  function half(event: DragEvent<HTMLElement>): DropMark["where"] {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }

  function startDrag(event: DragEvent<HTMLElement>, next: Drag) {
    drag.current = next;
    event.dataTransfer.effectAllowed = "move";
    // Firefox won't start a drag without data.
    event.dataTransfer.setData("text/plain", next.id);
    // The ghost is the whole row or chapter, not just the grip.
    const ghost = event.currentTarget.closest(next.kind === "chapter" ? "section" : "li");
    if (ghost) event.dataTransfer.setDragImage(ghost, 16, 14);
    // Dim on the next tick: changing the element now would change the ghost.
    window.setTimeout(() => {
      if (drag.current?.id === next.id) setDraggingId(next.id);
    }, 0);
  }

  function endDrag() {
    drag.current = null;
    mark(null);
    setDraggingId(null);
  }

  function flashMoved(id: string) {
    window.clearTimeout(movedTimer.current);
    setMovedId(id);
    movedTimer.current = window.setTimeout(() => setMovedId(null), 900);
  }

  function overForPage(event: DragEvent<HTMLElement>, key: string, where?: DropMark["where"]) {
    if (drag.current?.kind !== "page") return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    mark({ key, where: where ?? half(event) });
  }

  function overForChapter(event: DragEvent<HTMLElement>, chapterId: string) {
    if (drag.current?.kind !== "chapter") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    mark({ key: `chapter:${chapterId}`, where: half(event) });
  }

  function drop(event: DragEvent<HTMLElement>) {
    const dragged = drag.current;
    const target = dropRef.current;
    endDrag();
    if (!dragged || !target) return;
    event.preventDefault();

    const base = docRef.current;
    const [kind, id] = target.key.split(":");
    const offset = target.where === "after" ? 1 : 0;
    let next = base;
    if (dragged.kind === "page") {
      if (kind === "page") {
        const chapter = base.chapters.find((c) => c.pages.some((p) => p.id === id));
        if (chapter) {
          const pi = chapter.pages.findIndex((p) => p.id === id);
          next = movePage(base, dragged.id, chapter.id, pi + offset);
        }
      } else if (kind === "head") {
        next = movePage(base, dragged.id, id, 0);
      } else if (kind === "end") {
        next = movePage(base, dragged.id, id, Infinity);
      }
    } else if (kind === "chapter") {
      const ci = base.chapters.findIndex((c) => c.id === id);
      next = moveChapter(base, dragged.id, ci + offset);
    }
    if (next === base) return;
    if (dragged.kind === "page") revealPage(next, dragged.id);
    commit(next, { types: ["outline"] });
    flashMoved(dragged.id);
  }

  function nudgePage(pageId: string, dir: -1 | 1) {
    const base = docRef.current;
    const ci = base.chapters.findIndex((c) => c.pages.some((p) => p.id === pageId));
    if (ci === -1) return;
    const chapter = base.chapters[ci];
    const pi = chapter.pages.findIndex((p) => p.id === pageId);
    let next = base;
    if (dir < 0) {
      if (pi > 0) next = movePage(base, pageId, chapter.id, pi - 1);
      else if (ci > 0) next = movePage(base, pageId, base.chapters[ci - 1].id, Infinity);
    } else if (pi < chapter.pages.length - 1) {
      next = movePage(base, pageId, chapter.id, pi + 2);
    } else if (ci < base.chapters.length - 1) {
      next = movePage(base, pageId, base.chapters[ci + 1].id, 0);
    }
    if (next === base) return;
    focusAfterMove.current = `[data-page-id="${pageId}"] button`;
    revealPage(next, pageId);
    commit(next, { types: ["outline"] });
    flashMoved(pageId);
  }

  function nudgeChapter(chapterId: string, dir: -1 | 1) {
    const base = docRef.current;
    const ci = base.chapters.findIndex((c) => c.id === chapterId);
    const next = moveChapter(base, chapterId, dir < 0 ? ci - 1 : ci + 2);
    if (next === base) return;
    focusAfterMove.current = `[data-chapter-id="${chapterId}"] [data-grip]`;
    commit(next, { types: ["outline"] });
    flashMoved(chapterId);
  }

  // A page moved across chapters remounts, so focus has to be put back.
  useEffect(() => {
    const selector = focusAfterMove.current;
    if (!selector) return;
    focusAfterMove.current = null;
    document.querySelector<HTMLElement>(selector)?.focus();
  }, [doc]);

  function setFolded(next: ReadonlySet<string>) {
    startTransition(() => {
      addTransitionType("outline");
      setCollapsed(next);
    });
  }

  function toggleChapter(chapterId: string) {
    const next = new Set(collapsed);
    if (!next.delete(chapterId)) next.add(chapterId);
    setFolded(next);
  }

  const allCollapsed = doc.chapters.length > 0 && doc.chapters.every((c) => collapsed.has(c.id));

  function toggleAll() {
    setFolded(allCollapsed ? new Set() : new Set(doc.chapters.map((c) => c.id)));
  }

  /** A page moved into a folded chapter would vanish, so open that chapter. */
  function revealPage(next: CampaignDoc, pageId: string) {
    const home = next.chapters.find((c) => c.pages.some((p) => p.id === pageId));
    if (!home || !collapsed.has(home.id)) return;
    const open = new Set(collapsed);
    open.delete(home.id);
    setCollapsed(open);
  }

  /** Restores a snapshot through commit, so it autosaves like any edit. */
  function travel(direction: "past" | "future") {
    const from = direction === "past" ? past : future;
    const to = direction === "past" ? future : past;
    const target = from.current.at(-1);
    if (!target) return;
    const now = docRef.current;
    from.current = from.current.slice(0, -1);
    to.current = [...to.current.slice(-(HISTORY_LIMIT - 1)), now];
    lastEdit.current = null;

    const nowPages = new Set(flatten(now).map((e) => e.page.id));
    const nowChapters = new Set(now.chapters.map((c) => c.id));
    const targetEntries = flatten(target);
    const revivedPage = targetEntries.find((e) => !nowPages.has(e.page.id))?.page.id;
    const revivedChapter = target.chapters.find((c) => !nowChapters.has(c.id))?.id;
    const selected = current?.page.id;
    const keepOpener = openerFor && target.chapters.some((c) => c.id === openerFor) ? selectedId : null;
    const keepCharacter = characterFor && target.cast.includes(characterFor) ? selectedId : null;
    const known = new Set(characters.map((c) => c.id));
    const revivedCharacter = target.cast.find((id) => !now.cast.includes(id) && known.has(id));
    const select =
      revivedPage ??
      (revivedCharacter ? characterSelection(revivedCharacter) : null) ??
      keepOpener ??
      keepCharacter ??
      (selected && targetEntries.some((e) => e.page.id === selected) ? selected : targetEntries[0]?.page.id ?? null);

    if (select && !openerChapterId(select)) revealPage(target, select);
    commit(target, { types: ["outline"], select, skipHistory: true });
    const flash = revivedChapter ?? revivedPage ?? revivedCharacter;
    if (flash) flashMoved(flash);
  }

  // In a text field ⌘Z stays the browser's own text undo.
  const onUndoKey = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key !== "z" && !(key === "y" && event.ctrlKey)) return;
    // Present mode can't see the edits, so it can't undo them either.
    if (mode !== "edit" || isTextField(event.target) || confirmOpen || closing.current) return;
    event.preventDefault();
    travel(key === "y" || event.shiftKey ? "future" : "past");
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => onUndoKey(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function selectOpener(chapterId: string) {
    startTransition(() => {
      addTransitionType("page-next");
      setSelectedId(openerSelection(chapterId));
    });
  }

  function updateChapter(
    chapterId: string,
    change: (chapter: CampaignChapter) => CampaignChapter,
    options: CommitOptions = {},
  ) {
    const base = docRef.current;
    commit({ ...base, chapters: base.chapters.map((c) => (c.id === chapterId ? change(c) : c)) }, options);
  }

  function addOpener(chapterId: string) {
    updateChapter(chapterId, (c) => ({ ...c, opener: c.opener ?? blankOpener(c.title) }));
  }

  function removeOpener(chapterId: string) {
    updateChapter(chapterId, (c) => ({ ...c, opener: null }));
  }

  /** Typing coalesces per field; image changes are their own step. */
  function patchOpener(chapterId: string, patch: Partial<ChapterOpener>, structural = false) {
    updateChapter(
      chapterId,
      (c) => (c.opener ? { ...c, opener: { ...c.opener, ...patch } } : c),
      structural ? {} : { key: `opener:${chapterId}:${Object.keys(patch).join(",")}` },
    );
  }

  function startRename(pageId: string) {
    renameDone.current = false;
    renameOriginal.current = flatten(docRef.current).find((e) => e.page.id === pageId)?.page.title ?? "";
    setRenamingId(pageId);
  }

  /**
   * Refocus without the focus ring: finishing a rename shouldn't light up
   * the whole row. The ring comes back once focus moves on.
   */
  function focusPage(pageId: string) {
    requestAnimationFrame(() => {
      const button = document.querySelector<HTMLElement>(`[data-page-id="${pageId}"] button`);
      if (!button) return;
      button.dataset.quietFocus = "";
      button.addEventListener("blur", () => delete button.dataset.quietFocus, { once: true });
      button.focus();
    });
  }

  function endRename(pageId: string, cancel: boolean, refocus: boolean) {
    if (renameDone.current) return;
    renameDone.current = true;
    setRenamingId(null);
    if (cancel) {
      const current = flatten(docRef.current).find((e) => e.page.id === pageId)?.page.title;
      if (current !== renameOriginal.current) patchPage(pageId, { title: renameOriginal.current });
    }
    if (refocus) focusPage(pageId);
  }

  function ask(next: Pending) {
    setPending(next);
    setConfirmError(null);
    setConfirmOpen(true);
  }

  function requestPageDelete(page: CampaignPage) {
    removePage(page.id);
  }

  function requestChapterDelete(chapter: CampaignChapter) {
    if (chapter.opener !== null || chapter.pages.some(pageHasContent)) ask({ kind: "chapter", chapter });
    else removeChapter(chapter.id);
  }

  function confirmDelete() {
    if (!pending) return;
    if (pending.kind === "character") {
      const { id } = pending.character;
      startDelete(async () => {
        try {
          const result = await deleteCharacterAction(id);
          if (!result.ok) return setConfirmError(result.error);
        } catch {
          return setConfirmError("Couldn't reach the server");
        }
        characterPatches.current.delete(id);
        setCharacters((list) => list.filter((c) => c.id !== id));
        setConfirmOpen(false);
        // Deleting can't be undone, so leaving the cast isn't a history step either.
        const base = docRef.current;
        const next = { ...base, cast: base.cast.filter((c) => c !== id) };
        commit(next, {
          types: ["outline"],
          select: characterFor === id ? (flatten(next)[0]?.page.id ?? null) : undefined,
          skipHistory: true,
        });
      });
      return;
    }
    if (pending.kind === "chapter") {
      setConfirmOpen(false);
      return removeChapter(pending.chapter.id);
    }
    startDelete(async () => {
      closing.current = true;
      window.clearTimeout(timer.current);
      // Success redirects away; only a refusal comes back.
      const result = await deleteCampaignAction(campaignId);
      if (result) {
        closing.current = false;
        setConfirmError(result.error);
      }
    });
  }

  const dialogCopy = (() => {
    if (pending?.kind === "character") {
      const name = pending.character.name.trim();
      // This campaign is in the cast list even if the server's copy predates adding them.
      const character = pending.character.campaigns.some((c) => c.id === campaignId)
        ? pending.character
        : { ...pending.character, campaigns: [{ id: campaignId, title }, ...pending.character.campaigns] };
      return {
        title: `Delete ${name || "this character"}?`,
        body: <DeleteCharacterBody character={character} />,
        label: "Delete character",
      };
    }
    if (pending?.kind === "chapter") {
      const count = pending.chapter.pages.length;
      return {
        title: `Delete ${pending.chapter.title.trim() || "this chapter"}?`,
        body: `Its ${count} ${count === 1 ? "page goes" : "pages go"} with it.`,
        label: "Delete chapter",
      };
    }
    return {
      title: `Delete "${title}"?`,
      body: "Every chapter, page and image in it is removed for good. This can't be undone.",
      label: "Delete campaign",
    };
  })();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        {mode === "present" ? (
          <button
            type="button"
            className={styles.back}
            onClick={() => {
              if (tableId && presentSlide) setLeftAt({ table: tableId, slide: presentSlide });
              setMode("edit");
            }}
          >
            <BackIcon size={18} />
            Exit present mode
          </button>
        ) : (
          <Link href="/library" className={styles.back}>
            <BackIcon size={18} />
            Library
          </Link>
        )}
        {mode === "present" ? (
          <>
            <span className={styles.headerSpacer} />
            <PresentTableBar
              campaignId={campaignId}
              info={tableInfo}
              slide={presentSlide}
              beforeOpen={save}
              onInfo={setTableInfo}
            />
          </>
        ) : (
          <>
            <TitleField
              campaignId={campaignId}
              title={title}
              onRenamed={(next) => {
                setTitle(next);
                document.title = `${next} · Tabletop Retro`;
              }}
            />
            <SaveIndicator
              status={shownStatus}
              error={saveError}
              onRetry={() => {
                void save();
                void saveCharacters();
              }}
            />
            <div className={styles.presentWrap}>
              <button type="button" className={styles.presentButton} popoverTarget="present-from">
                <PlayIcon size={16} />
                Present
              </button>
              <div id="present-from" popover="auto" className={styles.presentMenu}>
                {continueTo ? (
                  <button
                    type="button"
                    className={styles.presentOption}
                    data-continue=""
                    onClick={(event) => {
                      event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
                      continuePresenting();
                    }}
                  >
                    Continue
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.presentOption}
                  onClick={(event) => {
                    event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
                    startPresenting(true);
                  }}
                >
                  From the beginning
                </button>
                <button
                  type="button"
                  className={styles.presentOption}
                  onClick={(event) => {
                    event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
                    startPresenting(false);
                  }}
                >
                  From this page
                </button>
              </div>
            </div>
            <button type="button" className={styles.settingsButton} onClick={() => setSettingsOpen(true)}>
              Settings
            </button>
          </>
        )}
      </header>

      <Activity mode={mode === "edit" ? "visible" : "hidden"}>
      <div className={styles.body}>
        <nav
          className={styles.outline}
          aria-label="Outline"
          data-reordering={draggingId ? "" : undefined}
          onDrop={drop}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) mark(null);
          }}
        >
          <section className={charStyles.cast} aria-label="Cast">
            <div className={charStyles.castHead}>
              <button
                type="button"
                className={styles.fold}
                aria-expanded={!castCollapsed}
                aria-controls="cast-list"
                aria-label={castCollapsed ? "Expand cast" : "Collapse cast"}
                onClick={() =>
                  startTransition(() => {
                    addTransitionType("outline");
                    setCastCollapsed((c) => !c);
                  })
                }
              >
                <ChevronIcon size={14} />
              </button>
              <p className={styles.eyebrow}>Cast</p>
            </div>
            {castCollapsed ? null : (
            <div id="cast-list">
            {cast.length > 0 ? (
              <ul className={styles.pages}>
                {cast.map((character) => {
                  const active = character.id === selectedCharacter?.id;
                  const name = character.name.trim();
                  return (
                    <ViewTransition key={character.id} {...ROW_MOTION} default="none">
                      <li
                        className={`${styles.pageRow} ${charStyles.castRow}`}
                        data-active={active ? "" : undefined}
                        data-moved={movedId === character.id ? "" : undefined}
                      >
                        <button
                          type="button"
                          className={styles.pageButton}
                          aria-current={active ? "page" : undefined}
                          onClick={() => selectCharacter(character.id)}
                        >
                          <CharacterPortrait character={character} size={22} />
                          <span className={styles.pageName} data-empty={name ? undefined : ""}>
                            {name || UNTITLED_CHARACTER}
                          </span>
                        </button>
                        <Tooltip content="Remove from campaign">
                          <button
                            type="button"
                            className={styles.rowAction}
                            aria-label={`Remove ${name || "this character"} from this campaign`}
                            onClick={() => removeFromCast(character.id)}
                          >
                            <CloseIcon size={14} />
                          </button>
                        </Tooltip>
                      </li>
                    </ViewTransition>
                  );
                })}
              </ul>
            ) : null}
            <div className={charStyles.castAdds}>
              {naming ? (
                <input
                  className={charStyles.newName}
                  placeholder="Character name"
                  aria-label="New character's name"
                  maxLength={CHARACTER_LIMITS.nameLength}
                  autoFocus
                  readOnly={creating}
                  onChange={() => setCastError(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createCharacter(event.currentTarget.value);
                    } else if (event.key === "Escape") {
                      setCastError(null);
                      setNaming(false);
                    }
                  }}
                  onBlur={(event) => {
                    if (!event.currentTarget.value.trim()) {
                      setCastError(null);
                      setNaming(false);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={styles.addRow}
                  onClick={() => {
                    setCastError(null);
                    setNaming(true);
                  }}
                >
                  <PlusIcon size={14} />
                  Character
                </button>
              )}
              {uncast.length > 0 ? (
                <button
                  type="button"
                  className={styles.addRow}
                  aria-expanded={libraryOpen}
                  aria-controls="cast-library"
                  onClick={() => setLibraryOpen((open) => !open)}
                >
                  From your characters
                </button>
              ) : null}
            </div>
            {libraryOpen && uncast.length > 0 ? (
              <ul className={charStyles.library} id="cast-library" aria-label="Your characters">
                {uncast.map((character) => {
                  const name = character.name.trim();
                  return (
                    <li key={character.id}>
                      <button
                        type="button"
                        className={charStyles.libraryItem}
                        onClick={() => addToCast(character.id)}
                      >
                        <CharacterPortrait character={character} size={20} />
                        <span className={charStyles.libraryName} data-empty={name ? undefined : ""}>
                          {name || UNTITLED_CHARACTER}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {castError ? (
              <p className={styles.fieldError} role="alert">
                {castError}
              </p>
            ) : null}
            </div>
            )}
          </section>

          <div className={styles.outlineHead}>
            <p className={styles.eyebrow}>Outline</p>
            {doc.chapters.length > 1 ? (
              <button type="button" className={styles.foldAll} onClick={toggleAll}>
                {allCollapsed ? "Expand all" : "Collapse all"}
              </button>
            ) : null}
          </div>
          {doc.chapters.map((chapter, ci) => (
            <ViewTransition key={chapter.id} {...ROW_MOTION} default="none">
              <section
                className={styles.chapter}
                data-chapter-id={chapter.id}
                data-drop={markOf(`chapter:${chapter.id}`)}
                data-dragging={draggingId === chapter.id ? "" : undefined}
                data-moved={movedId === chapter.id ? "" : undefined}
                onDragOver={(event) => overForChapter(event, chapter.id)}
              >
                <div
                  className={styles.chapterHead}
                  data-drop={markOf(`head:${chapter.id}`)}
                  onDragOver={(event) => overForPage(event, `head:${chapter.id}`, "after")}
                >
                  <span
                    className={styles.grip}
                    data-grip=""
                    role="button"
                    tabIndex={0}
                    draggable
                    aria-label={`Move chapter ${ci + 1}. Drag, or press Alt with the up or down arrow.`}
                    onDragStart={(event) => startDrag(event, { kind: "chapter", id: chapter.id })}
                    onDragEnd={endDrag}
                    onKeyDown={(event) => {
                      if (!isMoveKey(event)) return;
                      event.preventDefault();
                      nudgeChapter(chapter.id, event.key === "ArrowUp" ? -1 : 1);
                    }}
                  >
                    <GripIcon size={14} />
                  </span>
                  <button
                    type="button"
                    className={styles.fold}
                    aria-expanded={!collapsed.has(chapter.id)}
                    aria-controls={`pages-${chapter.id}`}
                    aria-label={`${collapsed.has(chapter.id) ? "Expand" : "Collapse"} ${chapter.title.trim() || `chapter ${ci + 1}`}`}
                    onClick={() => toggleChapter(chapter.id)}
                  >
                    <ChevronIcon size={14} />
                  </button>
                  <span className={styles.chapterNumber} aria-hidden>
                    {ci + 1}
                  </span>
                  <input
                    className={styles.chapterTitle}
                    value={chapter.title}
                    maxLength={DOC_LIMITS.titleLength}
                    placeholder={`Chapter ${ci + 1}`}
                    aria-label={`Chapter ${ci + 1} title`}
                    onChange={(event) => renameChapter(chapter.id, event.target.value)}
                  />
                  <Tooltip content={<OpenerTip opener={chapter.opener} />}>
                    <button
                      type="button"
                      className={styles.openerToggle}
                      data-on={chapter.opener ? "" : undefined}
                      aria-current={openerChapter?.id === chapter.id ? "page" : undefined}
                      aria-label={`${chapter.opener ? "Edit" : "Add"} the opener for ${chapter.title.trim() || `chapter ${ci + 1}`}`}
                      onClick={() => selectOpener(chapter.id)}
                    >
                      <OpenerIcon size={15} />
                    </button>
                  </Tooltip>
                  {chapter.opener ? (
                    <SoundBadges page={chapter.opener} playing={null} before={musicBefore.get(openerSelection(chapter.id)) ?? null} />
                  ) : null}
                  <Tooltip content="Delete chapter">
                    <button
                      type="button"
                      className={styles.rowAction}
                      aria-label={`Delete ${chapter.title.trim() || `chapter ${ci + 1}`}`}
                      onClick={() => requestChapterDelete(chapter)}
                    >
                      <TrashIcon size={15} />
                    </button>
                  </Tooltip>
                </div>
                {collapsed.has(chapter.id) ? null : (
                  <>
                    <ol className={styles.pages} id={`pages-${chapter.id}`}>
                      {chapter.pages.map((page, pi) => {
                        const active = page.id === current?.page.id;
                        return (
                          <ViewTransition key={page.id} {...ROW_MOTION} default="none">
                            <li
                              className={styles.pageRow}
                              data-active={active ? "" : undefined}
                              data-page-id={page.id}
                              data-drop={markOf(`page:${page.id}`)}
                              data-dragging={draggingId === page.id ? "" : undefined}
                              data-moved={movedId === page.id ? "" : undefined}
                              onDragOver={(event) => overForPage(event, `page:${page.id}`)}
                            >
                              {/* Mouse-only handle; the page button takes Alt+↑/↓. */}
                              <span
                                className={styles.grip}
                                draggable
                                aria-hidden
                                onDragStart={(event) => startDrag(event, { kind: "page", id: page.id })}
                                onDragEnd={endDrag}
                              >
                                <GripIcon size={14} />
                              </span>
                              {renamingId === page.id ? (
                                <div className={styles.pageButton}>
                                  <span className={styles.pageNumber}>
                                    {ci + 1}.{pi + 1}
                                  </span>
                                  <input
                                    className={styles.pageRename}
                                    defaultValue={page.title}
                                    maxLength={DOC_LIMITS.titleLength}
                                    placeholder={derivedLabel(page, cast) ?? EMPTY_PAGE_LABEL}
                                    aria-label={`Rename page ${ci + 1}.${pi + 1}`}
                                    autoFocus
                                    onFocus={(event) => event.currentTarget.select()}
                                onChange={(event) => patchPage(page.id, { title: event.target.value })}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        endRename(page.id, false, true);
                                      } else if (event.key === "Escape") {
                                        event.preventDefault();
                                        endRename(page.id, true, true);
                                      }
                                    }}
                                    onBlur={() => endRename(page.id, false, false)}
                                  />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.pageButton}
                                  aria-current={active ? "page" : undefined}
                                  onClick={() => select(page.id)}
                                  onDoubleClick={() => startRename(page.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === "F2") {
                                      event.preventDefault();
                                      startRename(page.id);
                                      return;
                                    }
                                    if (!isMoveKey(event)) return;
                                    event.preventDefault();
                                    nudgePage(page.id, event.key === "ArrowUp" ? -1 : 1);
                                  }}
                                >
                                  <span className={styles.pageNumber}>
                                    {ci + 1}.{pi + 1}
                                  </span>
                                  <PageName label={pageLabel(page, cast)} />
                                  {page.kind === "activity" ? (
                                    <ActivityIcon size={14} className={styles.pageHasImage} title="Activity" />
                                  ) : page.kind === "speech" ? (
                                    <QuoteIcon size={14} className={styles.pageHasImage} title="Speaking line" />
                                  ) : page.image ? (
                                    <ImageIcon size={14} className={styles.pageHasImage} />
                                  ) : null}
                                  <SoundBadges page={page} playing={musicNow.get(page.id) ?? null} before={musicBefore.get(page.id) ?? null} />
                                </button>
                              )}
                              <Tooltip content="Delete page · ⌘Z brings it back">
                                <button
                                  type="button"
                                  className={styles.rowAction}
                                  aria-label={`Delete page ${ci + 1}.${pi + 1}`}
                                  onClick={() => requestPageDelete(page)}
                                >
                                  <CloseIcon size={14} />
                                </button>
                              </Tooltip>
                            </li>
                          </ViewTransition>
                        );
                      })}
                    </ol>
                    {chapter.pages.length < DOC_LIMITS.pagesPerChapter ? (
                      <button
                        type="button"
                        className={styles.addRow}
                        data-drop={markOf(`end:${chapter.id}`)}
                        onClick={() => addPage(chapter.id)}
                        onDragOver={(event) => overForPage(event, `end:${chapter.id}`, "before")}
                      >
                        <PlusIcon size={14} />
                        Page
                      </button>
                    ) : null}
                  </>
                )}
              </section>
            </ViewTransition>
          ))}
          {doc.chapters.length < DOC_LIMITS.chapters ? (
            <button type="button" className={`${styles.addRow} ${styles.addChapter}`} onClick={addChapter}>
              <PlusIcon size={14} />
              Chapter
            </button>
          ) : null}
        </nav>

        <main className={styles.stage}>
          {selectedCharacter ? (
            <ViewTransition key={`character-${selectedCharacter.id}`} {...EDIT_PAGE_MOTION} default="none">
              <div>
                <CharacterEditor
                  character={selectedCharacter}
                  campaignId={campaignId}
                  onRename={(name) => renameCharacter(selectedCharacter.id, name)}
                  onChange={(patch) => patchCharacter(selectedCharacter.id, patch)}
                  // Only the images come back from the server; taking the
                  // rest would undo typing that hasn't saved yet.
                  onReplaced={(fresh) =>
                    setCharacters((list) =>
                      list.map((c) =>
                        c.id === fresh.id ? { ...c, portrait: fresh.portrait, artwork: fresh.artwork } : c,
                      ),
                    )
                  }
                  onRemove={() => removeFromCast(selectedCharacter.id)}
                  onDelete={() => ask({ kind: "character", character: selectedCharacter })}
                />
              </div>
            </ViewTransition>
          ) : openerChapter ? (
            <ViewTransition key={`opener-${openerChapter.id}`} {...EDIT_PAGE_MOTION} default="none">
              <div>
                <OpenerEditor
                  campaignId={campaignId}
                  chapter={openerChapter}
                  label={`Chapter ${doc.chapters.indexOf(openerChapter) + 1}`}
                  onAdd={() => addOpener(openerChapter.id)}
                  onRemove={() => removeOpener(openerChapter.id)}
                  onChange={(patch) => patchOpener(openerChapter.id, patch)}
                  onStructuralChange={(patch) => patchOpener(openerChapter.id, patch, true)}
                  musicBefore={(() => {
                    const all = slidesOf(doc);
                    return musicAt(all, all.findIndex((sl) => sl.id === openerSelection(openerChapter.id)) - 1);
                  })()}
                />
              </div>
            </ViewTransition>
          ) : current ? (
            <ViewTransition key={current.page.id} {...EDIT_PAGE_MOTION} default="none">
              <div>
                <PageEditor
                  campaignId={campaignId}
                  page={current.page}
                  cast={cast}
                  label={`${current.chapter.title.trim() || `Chapter ${current.ci + 1}`} · Page ${current.ci + 1}.${current.pi + 1}`}
                  onChange={(patch) => patchPage(current.page.id, patch)}
                  onStructuralChange={(pageId, patch) => patchPage(pageId, patch, ["image"])}
                  musicBefore={(() => {
                    const all = slidesOf(doc);
                    return musicAt(all, all.findIndex((sl) => sl.id === current.page.id) - 1);
                  })()}
                />
              </div>
            </ViewTransition>
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                {doc.chapters.length === 0 ? "This campaign is empty" : "No pages yet"}
              </p>
              <p className={styles.emptyText}>
                A page is an image, if you want one, and the words under it.
              </p>
              <button
                type="button"
                className={ui.primary}
                onClick={() => (doc.chapters.length === 0 ? addChapter() : addPage(doc.chapters[0].id))}
              >
                <PlusIcon size={18} />
                {doc.chapters.length === 0 ? "Add a chapter" : "Add a page"}
              </button>
            </div>
          )}
        </main>
      </div>
      </Activity>

      <Activity mode={mode === "present" ? "visible" : "hidden"}>
        <PresentView
          campaignId={campaignId}
          doc={doc}
          cast={cast}
          seats={tableInfo.table ? tableInfo.seats : null}
          remoteActivity={remoteActivity}
          onLeadAction={(slide, action, payload) => leadActivityAction(campaignId, slide, action, payload)}
          onShowAnswers={(slide, shown) => {
            if (tableInfo.table) showAnswersAction(campaignId, slide, shown).catch(() => undefined);
          }}
          onRestartTimer={(slide) => {
            if (tableInfo.table) restartTimerAction(campaignId, slide).catch(() => undefined);
          }}
          onRemoveSeat={(seatId) => {
            removeSeatAction(campaignId, seatId).catch(() => undefined);
          }}
          onReleaseSeat={(seatId) => {
            releaseSeatAction(campaignId, seatId).catch(() => undefined);
          }}
          onVideoPlayback={(slide, playing, position) => {
            if (tableInfo.table) setPlaybackAction(campaignId, slide, playing, position).catch(() => undefined);
          }}
          selectedId={openerChapter ? openerSelection(openerChapter.id) : (current?.page.id ?? null)}
          onNavigate={(pageId, direction) =>
            startTransition(() => {
              addTransitionType(direction);
              setSelectedId(pageId);
            })
          }
        />
      </Activity>

      <SettingsDialog
        open={settingsOpen}
        campaignId={campaignId}
        info={tableInfo}
        onInfo={setTableInfo}
        onDelete={() => {
          setSettingsOpen(false);
          ask({ kind: "campaign" });
        }}
        onClose={() => setSettingsOpen(false)}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={dialogCopy.title}
        confirmLabel={dialogCopy.label}
        pending={deleting}
        error={confirmError}
        onConfirm={confirmDelete}
        onClose={() => setConfirmOpen(false)}
      >
        {dialogCopy.body}
      </ConfirmDialog>
    </div>
  );
}

function PageName({ label }: { label: PageLabel }) {
  return (
    <span
      className={styles.pageName}
      data-derived={label.derived && !label.empty ? "" : undefined}
      data-empty={label.empty ? "" : undefined}
    >
      {label.text}
    </span>
  );
}

function OpenerTip({ opener }: { opener: ChapterOpener | null }) {
  return (
    <>
      <span className={styles.tipLabel}>Chapter opener</span>
      {opener ? (
        <>
          <span className={styles.tipTitle}>{opener.title.trim() || "Untitled opener"}</span>
          <span className={styles.tipText}>Click to edit</span>
        </>
      ) : (
        <>
          <span className={styles.tipTitle}>None yet</span>
          <span className={styles.tipText}>
            A title slide before this chapter&apos;s first page. Click to add one.
          </span>
        </>
      )}
    </>
  );
}

function SaveIndicator({
  status,
  error,
  onRetry,
}: {
  status: SaveStatus;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <p className={`${styles.status} ${styles.statusError}`} role="alert">
        <Tooltip content={error ?? "Couldn't save"} side="bottom">
          <span tabIndex={0}>Couldn&apos;t save</span>
        </Tooltip>
        <button type="button" className={styles.retry} onClick={onRetry}>
          Retry
        </button>
      </p>
    );
  }
  return (
    <p className={styles.status} aria-live="polite" data-busy={status === "saved" ? undefined : ""}>
      {status === "saved" ? "Saved" : "Saving…"}
    </p>
  );
}
