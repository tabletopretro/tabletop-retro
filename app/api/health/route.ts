import { sql } from "drizzle-orm";
import { db } from "@/db";

/** For load balancers and container probes: 200 once the database answers, 503 otherwise. */
export function GET() {
  try {
    db.get(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
