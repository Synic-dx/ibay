/**
 * FEATURE: Authentication (Auth.js v5) [RUBRIC:AUTH]
 * WHAT: Two ways in, both limited to @iimidr.ac.in:
 *   1. Continue with Google. `hd=iimidr.ac.in` is only a hint to Google, so the
 *      signIn callback re-checks the domain and that Google verified the email.
 *   2. Email + 6-digit code. features/auth/actions.ts checks the code, then
 *      hands Auth.js a 60-second signed ticket (see ticket.ts).
 * SESSION: a JWT in an httpOnly, sameSite=lax cookie (secure on https). It holds
 *      only the profile id; everything else is read fresh from the database.
 * CSRF: Auth.js protects its own endpoints; Server Actions are POST-only and
 *      Next.js checks the Origin header.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { readTicket } from "./ticket";
import { cookies } from "next/headers";
import { AUTH_INTENT_COOKIE, accountExists, upsertProfileByEmail } from "./profiles";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

const clean = (s?: string) => s?.replace(/^["']|["']$/g, "").trim() || "";
const DOMAIN = clean(process.env.ALLOWED_EMAIL_DOMAIN) || "iimidr.ac.in";
const googleId = clean(process.env.AUTH_GOOGLE_ID);
const googleSecret = clean(process.env.AUTH_GOOGLE_SECRET);
const hasGoogle = Boolean(googleId && googleSecret);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: clean(process.env.AUTH_SECRET) || process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 3600 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(hasGoogle
      ? [
          Google({
            clientId: googleId,
            clientSecret: googleSecret,
            authorization: { params: { hd: DOMAIN, prompt: "select_account" } },
          }),
        ]
      : []),
    Credentials({
      id: "otp",
      name: "Email code",
      credentials: { ticket: { type: "text" } },
      // The ticket is only issued after the code was checked on the server.
      authorize: async (credentials) => {
        const profileId = readTicket(typeof credentials?.ticket === "string" ? credentials.ticket : null);
        return profileId ? { id: profileId } : null;
      },
    }),
  ],
  callbacks: {
    /** Domain lock for Google, checked on the server (never trust the client or the hd hint). */
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const email = String(profile?.email ?? "").toLowerCase();
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
      if (!verified || !email.endsWith("@" + DOMAIN)) return "/login?error=domain";
      // Same rules as email sign-in: "sign in" needs an account, "create account" needs a new email.
      const jar = await cookies();
      const intent = jar.get(AUTH_INTENT_COOKIE)?.value === "signup" ? "signup" : "signin";
      jar.delete(AUTH_INTENT_COOKIE);
      const exists = await accountExists(email);
      if (intent === "signin" && !exists) return "/login?error=noaccount";
      if (intent === "signup" && exists) return "/login?error=exists";
      return true;
    },
    /** Put our profile id into the JWT. For Google, create the profile on first sign-in. */
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const p = await upsertProfileByEmail(String(profile.email), String(profile.name ?? ""), (profile as { picture?: string }).picture);
        token.uid = p.id;
      } else if (user?.id) {
        token.uid = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = String(token.uid);
      return session;
    },
  },
});

export const googleEnabled = hasGoogle;
