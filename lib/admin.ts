import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "invictus_admin";

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "development-admin-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function createAdminToken() {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function isValidAdminToken(token?: string) {
  if (!token) return false;
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return false;

  const maxAgeMs = 1000 * 60 * 60 * 8;
  if (Date.now() - Number(issuedAt) > maxAgeMs) return false;

  const expected = sign(issuedAt);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function assertAdmin() {
  const token = cookies().get(cookieName)?.value;
  if (!isValidAdminToken(token)) {
    throw new Error("UNAUTHORIZED");
  }
}

export function setAdminCookie(token: string) {
  cookies().set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}
