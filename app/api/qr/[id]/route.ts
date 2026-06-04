import { NextResponse } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

type QrRouteProps = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: QrRouteProps) {
  const publicId = params.id.trim();
  if (!publicId) {
    return NextResponse.json({ error: "Registration ID is required." }, { status: 400 });
  }

  const passUrl = new URL(`/verify/pass/${encodeURIComponent(publicId)}`, request.url).toString();
  const svg = await QRCode.toString(passUrl, {
    type: "svg",
    margin: 1,
    width: 260,
    color: {
      dark: "#271646",
      light: "#ffffff"
    }
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300"
    }
  });
}

