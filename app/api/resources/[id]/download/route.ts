import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

function isVercelBlobUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith("vercel-storage.com") || hostname.endsWith("public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function cleanFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extensionFromUrl(fileUrl: string) {
  try {
    const pathname = new URL(fileUrl).pathname;
    const match = pathname.match(/\.([a-z0-9]{2,5})(?:$|[/?#])/i);
    return match?.[1]?.toLowerCase() || "";
  } catch {
    return "";
  }
}

function cleanBaseName(resource: { title: string; category: string }) {
  return [resource.category, resource.title].map(cleanFilenamePart).filter(Boolean).join("-") || "invictus-resource";
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: params.id },
      select: { title: true, category: true, fileUrl: true }
    });

    if (!resource || !resource.fileUrl) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    const cleanName = cleanBaseName(resource);
    const extension = extensionFromUrl(resource.fileUrl) || "file";
    const filename = `${cleanName}.${extension}`;

    // For Vercel Blob URLs: proxy the file so we can force a download filename.
    // Blob URLs are public and fast — fetch and stream with correct headers.
    if (isVercelBlobUrl(resource.fileUrl)) {
      const upstream = await fetch(resource.fileUrl, { cache: "no-store" });
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json({ error: "Resource is temporarily unavailable." }, { status: 502 });
      }
      const fileBuffer = await upstream.arrayBuffer();
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Content-Length": String(fileBuffer.byteLength),
          "Cache-Control": "private, max-age=300"
        }
      });
    }

    // Fallback for legacy Cloudinary URLs (existing resources in DB)
    const upstream = await fetch(resource.fileUrl, { cache: "no-store" }).catch(() => null);
    if (!upstream?.ok || !upstream.body) {
      return NextResponse.json({ error: "Resource is temporarily unavailable." }, { status: 502 });
    }
    const fileBuffer = await upstream.arrayBuffer();
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(fileBuffer.byteLength),
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Resources are temporarily unavailable." }, { status: 500 });
  }
}
