// Idempotent. Run from the project root.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_PATH ?? "dev.db");
db.pragma("foreign_keys = ON");

const USERS = [
  { id: "user-ada", name: "Ada" },
  { id: "user-morgan", name: "Morgan" },
  { id: "user-sam", name: "Sam" },
  { id: "user-riley", name: "Riley" },
];

/** Fixed ids so re-seeding is a no-op. */
const CAMPAIGN = {
  id: "campaign-example-retro",
  ownerId: USERS[0].id,
  title: "Example retro",
  contentPath: "example-retro-seed0001",
};

const page = (id, fields) => ({
  id,
  title: "",
  kind: "story",
  activity: null,
  heading: "",
  headingReveal: 0,
  headingRevealBy: "letter",
  notes: "",
  image: null,
  imageAlt: "",
  text: "",
  video: null,
  videoAutoplay: false,
  music: null,
  effect: null,
  speakerId: null,
  line: "",
  ...fields,
});

const DOC = {
  version: 1,
  title: CAMPAIGN.title,
  cast: [],
  chapters: [
    {
      id: "chapter001",
      title: "Looking back",
      opener: {
        title: "Looking back",
        subtitle: "The last sprint, as a one-shot",
        image: null,
        imageAlt: "",
        notes: "Open the table for players before you start, so they can join with the code.",
        music: null,
        effect: null,
      },
      pages: [
        page("page000001", {
          heading: "Welcome to the table",
          text: "Everyone joins with the table code on their own device. The Table Lead moves the slides; you answer on yours.",
          notes: "Read this out. Check everyone has taken a seat (the list on the right).",
        }),
        page("page000002", {
          kind: "activity",
          activity: { type: "qa", timer: 120, settings: {}, prompt: "What went well this sprint?", anonymous: false },
          notes: "Two minutes. Show the answers when the timer's out and read a few aloud.",
        }),
        page("page000003", {
          kind: "activity",
          activity: {
            type: "vote",
            timer: 60,
            settings: {},
            prompt: "Which one do we fix first?",
            options: ["Flaky tests", "Slow reviews", "Unclear tickets", "Too many meetings"],
            anonymous: true,
          },
          notes: "Anonymous. Show the results, then talk about the winner.",
        }),
      ],
    },
    {
      id: "chapter002",
      title: "Who goes first",
      opener: null,
      pages: [
        page("page000004", {
          kind: "activity",
          activity: { type: "dice", timer: 0, settings: { dice: "rune" } },
          notes: "Hand the dice to whoever volunteers to own the first fix. Highest roll goes first.",
        }),
        page("page000005", {
          heading: "Thanks for playing",
          text: "Close the table when you're done. The answers stay with it.",
        }),
      ],
    },
  ],
};

const seed = db.transaction(() => {
  for (const u of USERS) {
    db.prepare("INSERT OR IGNORE INTO users (id, name) VALUES (@id, @name)").run(u);
    db.prepare(
      "INSERT OR IGNORE INTO accounts (provider, provider_account_id, user_id) VALUES ('local', @id, @id)",
    ).run(u);
  }

  const existing = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(CAMPAIGN.id);
  if (existing) return false;
  db.prepare(
    "INSERT INTO campaigns (id, owner_id, title, content_path) VALUES (@id, @ownerId, @title, @contentPath)",
  ).run(CAMPAIGN);
  const folder = path.join(process.env.CONTENT_DIR ?? path.join(process.cwd(), "content"), "campaigns", CAMPAIGN.contentPath);
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, "campaign.json"), JSON.stringify(DOC, null, 2));
  return true;
});

const created = seed();
console.log(`Seeded ${USERS.length} users${created ? ` and the "${CAMPAIGN.title}" campaign` : ""}.`);
