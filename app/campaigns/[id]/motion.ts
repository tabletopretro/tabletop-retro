/** Same page-next / page-prev types as the editor; only the classes differ. */
export const DECK_MOTION = {
  enter: { "page-next": "deck-next", "page-prev": "deck-prev", default: "none" },
  exit: { "page-next": "deck-next", "page-prev": "deck-prev", default: "none" },
} as const;

export const EDIT_PAGE_MOTION = {
  enter: { "page-next": "page-fade", "page-prev": "page-fade", default: "none" },
  exit: { "page-next": "page-fade", "page-prev": "page-fade", default: "none" },
} as const;

/** The old current's highlight goes as the move starts, the new one's a beat later, so two never show. */
export function stripMotion(isCurrent: boolean) {
  const move = isCurrent ? "strip-move-current" : "strip-move";
  return {
    enter: { "page-next": "strip-in", "page-prev": "strip-in", default: "none" },
    exit: { "page-next": "strip-out", "page-prev": "strip-out", default: "none" },
    update: { "page-next": move, "page-prev": move, default: "none" },
  } as const;
}
