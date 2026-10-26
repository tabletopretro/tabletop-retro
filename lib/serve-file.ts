import "server-only";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";

export const MEDIA_TYPES: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

/** Range support for seeking. Callers have checked access and that `file` came from a generated name. */
export function serveMedia(request: Request, file: string): Response {
  let size: number;
  try {
    size = statSync(file).size;
  } catch {
    return new Response(null, { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": MEDIA_TYPES[file.split(".").pop() ?? ""] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    // Names are random and never reused, so the bytes never change.
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    // "bytes=a-b", "bytes=a-" or the last n bytes ("bytes=-n").
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
