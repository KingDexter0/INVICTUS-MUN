import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "invictus_eb";

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "development-eb-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function createEbToken(profileId: string) {
  const issuedAt = Date.now().toString();
  const payload = `${profileId}.${issuedAt}`;
  return `${payload}.${sign(payload)}`;
}

export function getEbProfileId() {
  const token = cookies().get(cookieName)?.value;
  if (!token) return null;
  const [profileId, issuedAt, signature] = token.split(".");
  if (!profileId || !issuedAt || !signature) return null;
  if (Date.now() - Number(issuedAt) > 1000 * 60 * 60 * 24 * 14) return null;
  const expected = sign(`${profileId}.${issuedAt}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  return timingSafeEqual(actualBuffer, expectedBuffer) ? profileId : null;
}

export function setEbCookie(token: string) {
  cookies().set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

