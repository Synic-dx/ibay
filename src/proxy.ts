/**
 * FEATURE: Protected routes [RUBRIC:AUTH]
 * WHAT: Next.js 16 "proxy" (the new name for middleware). Guests who open a
 *       private page are sent to /login?next=<page> and come back after signing in.
 * NOTE: this is the quick first check. Every page and Server Action checks the
 *       session again on the server (lib/auth/session.ts), so the proxy is never
 *       the only lock.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PROTECTED = [/^\/sell/, /^\/my-listings/, /^\/listings\/[^/]+\/edit/, /^\/deals/, /^\/messages/, /^\/account/, /^\/admin/, /^\/saved/, /^\/notifications/, /^\/you/];

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (!req.auth && PROTECTED.some((re) => re.test(pathname))) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|img/|art/|favicon.ico|icon.svg).*)"],
};
