import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Generic short-lived HMAC-signed token: base64url(JSON payload) + "." + hex HMAC-SHA256
 * signature over that base64url segment. Stateless — verified with no DB/network round
 * trip, just the shared secret. Used for:
 *  - WP visitor identity tokens (wp-plugin/mpe-chatbot mirrors this exact scheme in PHP,
 *    see includes/class-mpe-auth.php)
 *  - Short-lived signed invoice download links (see adapters/invoice/backendPdfStrategy.ts)
 */

export interface TokenPayload {
  [key: string]: unknown;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64").toString("utf8");
}

function sign(segment: string, secret: string): string {
  return createHmac("sha256", secret).update(segment).digest("hex");
}

export function issueToken<T extends object>(data: T, secret: string, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { ...data, iat: now, exp: now + ttlSeconds };
  const segment = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(segment, secret);
  return `${segment}.${signature}`;
}

export type VerifyResult<T> =
  | { ok: true; payload: T & TokenPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyToken<T extends object = Record<string, unknown>>(
  token: string,
  secret: string
): VerifyResult<T> {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [segment, signature] = parts;

  const expected = sign(segment, secret);
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: T & TokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(segment));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}
