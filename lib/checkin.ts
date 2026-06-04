import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isValidAdminToken } from "./admin";

const checkInCookieName = "invictus_checkin";
const adminCookieName = "invictus_admin";

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "development-checkin-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function useSecureCookie() {
  return process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
}

export function createCheckInToken() {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function isValidCheckInToken(token?: string) {
  if (!token) return false;
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return false;

  const maxAgeMs = 1000 * 60 * 60 * 12;
  if (Date.now() - Number(issuedAt) > maxAgeMs) return false;

  const expected = sign(issuedAt);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function hasCheckInAccess() {
  const cookieStore = cookies();
  return (
    isValidCheckInToken(cookieStore.get(checkInCookieName)?.value) ||
    isValidAdminToken(cookieStore.get(adminCookieName)?.value)
  );
}

export function assertCheckInAccess() {
  if (!hasCheckInAccess()) {
    throw new Error("UNAUTHORIZED");
  }
}

export function setCheckInCookie(token: string) {
  cookies().set(checkInCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(),
    path: "/",
    maxAge: 60 * 60 * 12
  });
}
