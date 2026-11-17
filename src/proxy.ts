/**
 * FEATURE: Protected routes [RUBRIC:AUTH]
 * WHAT: Next.js 16 "proxy" (the new name for middleware). Guests who open a
 *       private page are sent to /login?next=<page> and come back after signing in.
 * HOW: a quick, optimistic check for the Auth.js session cookie. It stays
 *       light on purpose (no database, no Auth.js import) so it runs fast on
 *       every request.
 * NOTE: this is never the only lock. Every protected page and every Server
 *       Action verifies the session again on the server (lib/auth/session.ts).
 */
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = [/^\/sell/, /^\/my-listings/, /^\/listings\/[^/]+\/edit/, /^\/deals/, /^\/messages/, /^\/account/, /^\/admin/, /^\/saved/, /^\/notifications/, /^\/you/];
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const signedIn = SESSION_COOKIES.some((n) => req.cookies.has(n));
  if (!signedIn && PROTECTED.some((re) => re.test(pathname))) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|img/|art/|favicon.ico|icon.svg).*)"],
};
