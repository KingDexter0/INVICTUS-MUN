import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { sendWhatsAppTemplate } from "../../../../lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAdmin();
    const { phone, trigger = "Admin test WhatsApp" } = await request.json();
    if (!phone) return NextResponse.json({ error: "Phone is required." }, { status: 400 });
    const result = await sendWhatsAppTemplate({ phone: String(phone), trigger: String(trigger), parameters: ["Invictus MUN"] });
    return NextResponse.json({ whatsappStatus: result.status });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not send WhatsApp test." }, { status: 500 });
  }
}

