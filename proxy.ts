import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/config";

/**
 * Optimistic cookie check only; requireUser() is the real check.
 * No return-to param: an unvalidated ?next= is an open redirect.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/sign-in", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/library/:path*", "/campaigns/:path*", "/tl/:path*"],
};
