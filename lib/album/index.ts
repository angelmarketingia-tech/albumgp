// Public surface of the album domain. Callers (the API route) import from
// here so this stays the single source of truth.

export type {
  AlbumPrize,
  AlbumRedemption,
  AlbumResponse,
} from "./types";

export {
  getAlbumForAccount,
  type AlbumPrismaClient,
} from "./query";
