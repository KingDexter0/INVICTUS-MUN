import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "invictus_delegate";

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "development-delegate-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function createDelegateToken(registrationId: string) {
  const issuedAt = Date.now().toString();
  const payload = `${registrationId}.${issuedAt}`;
  return `${payload}.${sign(payload)}`;
}

export function getDelegateRegistrationIdFromToken(token?: string) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [registrationId, issuedAt, signature] = parts;
  if (!registrationId || !issuedAt || !signature) return null;

  const maxAgeMs = 1000 * 60 * 60 * 24 * 14;
  if (Date.now() - Number(issuedAt) > maxAgeMs) return null;

  const expected = sign(`${registrationId}.${issuedAt}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;

  return timingSafeEqual(actualBuffer, expectedBuffer) ? registrationId : null;
}

export function getDelegateRegistrationId() {
  return getDelegateRegistrationIdFromToken(cookies().get(cookieName)?.value);
}

/**
 * Returns the resolved { type, id } from the delegate session cookie.
 * type: "individual" | "delegate" | "legacy"
 * id: the database record id
 */
export function getDelegateSessionInfo(): { type: "individual" | "delegate" | "legacy"; id: string } | null {
  const raw = getDelegateRegistrationId();
  if (!raw) return null;

  if (raw.startsWith("individual:")) return { type: "individual", id: raw.slice("individual:".length) };
  if (raw.startsWith("delegate:")) return { type: "delegate", id: raw.slice("delegate:".length) };
  // Legacy tokens (plain uuid/cuid with no prefix) kept for backwards compat
  return { type: "legacy", id: raw };
}

export function setDelegateCookie(token: string) {
  cookies().set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export function clearDelegateCookie(response: NextResponse) {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
