/** Re-exports the Auth.js route handlers for app/api/auth/[...nextauth]. */
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
