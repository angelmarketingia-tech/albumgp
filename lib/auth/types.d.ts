/**
 * Module augmentation for Auth.js v5 to add `account_id` to the JWT and to
 * type `session.user.id` as a required string (Auth.js leaves it optional).
 *
 * Keep this file purely declarative — no runtime imports here so it stays a
 * type-only side effect.
 */

import "next-auth";
import "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT {
    /** Stable account identifier persisted into `redemptions.account_id`. */
    account_id?: string;
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}
