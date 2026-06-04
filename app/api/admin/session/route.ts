import { NextResponse } from "next/server";
import { createAdminToken, setAdminCookie } from "../../../../lib/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { passcode } = await request.json();
  const expected = process.env.ADMIN_PASSCODE;

  if (!expected || passcode !== expected) {
    return NextResponse.json({ error: "Invalid admin passcode." }, { status: 401 });
  }

  setAdminCookie(createAdminToken());
  return NextResponse.json({ ok: true });
}
