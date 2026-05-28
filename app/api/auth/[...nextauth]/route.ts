/**
 * Auth.js v5 catch-all route handler.
 *
 * Auth.js exposes `handlers` (a `{ GET, POST }` pair) from the configured
 * NextAuth instance. We re-export both verbs so the App Router picks them
 * up at `/api/auth/*` (sign-in, callbacks, CSRF, providers, etc.).
 *
 * SERVER ONLY. Do not import this file from anywhere else.
 */

import { handlers } from "@/lib/auth/auth-config";

export const { GET, POST } = handlers;

// Auth.js needs the Node.js runtime (uses node:crypto + node-only providers).
export const runtime = "nodejs";
