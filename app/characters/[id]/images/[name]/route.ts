import { readFile } from "node:fs/promises";
import { getCurrentUser } from "@/lib/auth/dal";
import { characterForOwner, characterImagePath } from "@/lib/characters";

const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
};

/** Owner-only; every failure is a bare 404 so ids and names can't be probed. */
export async function GET(_request: Request, ctx: RouteContext<"/characters/[id]/images/[name]">) {
  const notFound = () => new Response(null, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return notFound();

  const { id, name } = await ctx.params;
  const character = characterForOwner(id, user.id);
  const file = character ? characterImagePath(character, name) : null;
  if (!file) return notFound();

  try {
    const bytes = await readFile(file);
    return new Response(bytes, {
      headers: {
        "Content-Type": CONTENT_TYPES[name.split(".").pop() ?? ""] ?? "application/octet-stream",
        // Names are random and never reused, so the bytes never change.
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
