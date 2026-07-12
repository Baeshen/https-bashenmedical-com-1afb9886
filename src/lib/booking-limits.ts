/**
 * Single source of truth for booking input limits.
 *
 * Consumed by BOTH the client wizard (`src/components/booking/types.ts`,
 * used by `/book` and its Step* components) AND the public API endpoint
 * (`src/routes/api/public/book/create.ts`). Never fork these values —
 * changing them on one side without the other allows requests to pass
 * one gate and get rejected by the other.
 */

export const NAME_MIN = 2;
export const NAME_MAX = 120;

export const PHONE_MIN = 6;
export const PHONE_MAX = 32;

export const NID_MAX = 20;

export const REASON_MAX = 500;
export const NOTES_MAX = 500;

/** Loose phone character allowlist (server-side pre-check). */
export const PHONE_RE = /^[+0-9\s\-()]+$/;

/** Saudi mobile: local 05XXXXXXXX (10 digits) OR international +9665XXXXXXXX / 009665XXXXXXXX. */
export const SA_PHONE_RE = /^(?:(?:\+?966)|0)?5\d{8}$/;

/** 10-digit Saudi National ID / Iqama (starts with 1 or 2). */
export const SA_NID_RE = /^[12]\d{9}$/;

/** Full name: starts with a letter, allows spaces/apostrophes/dots/hyphens. */
export const NAME_RE = /^[\p{L}][\p{L}\s'.-]{1,}$/u;
