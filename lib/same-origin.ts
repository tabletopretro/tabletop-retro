/**
 * For route handlers, which don't get the server-action origin check. Compares hosts as Next does
 * for actions: behind a TLS-terminating proxy request.url is the upstream's http URL, so it can't be
 * compared with the browser's https Origin. A cross-site page can't set X-Forwarded-Host without a
 * preflight, so trusting it here is safe.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() ?? request.headers.get("host");
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}
