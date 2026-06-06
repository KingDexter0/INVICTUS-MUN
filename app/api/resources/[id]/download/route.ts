import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { isSafeExternalUrl } from "../../../../../lib/security";

export const dynamic = "force-dynamic";

const contentTypeExtensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx"
};

function contentTypeKey(contentType: string | null) {
  return String(contentType || "").split(";")[0].trim().toLowerCase();
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

function extensionFromContentDisposition(contentDisposition: string | null) {
  if (!contentDisposition) {
    return "";
  }

  const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  if (!filenameMatch?.[1]) {
    return "";
  }

  try {
    return extensionFromUrl(`https://invictus.local/${decodeURIComponent(filenameMatch[1].replace(/"/g, ""))}`);
  } catch {
    return extensionFromUrl(`https://invictus.local/${filenameMatch[1].replace(/"/g, "")}`);
  }
}

function cleanBaseName(resource: { title: string; category: string }) {
  return [resource.category, resource.title].map(cleanFilenamePart).filter(Boolean).join("-") || "invictus-resource";
}

function cloudinaryRawCandidate(fileUrl: string) {
  if (!fileUrl.includes("/image/upload/")) {
    return "";
  }

  return fileUrl.replace("/image/upload/", "/raw/upload/");
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: params.id },
      select: { title: true, category: true, fileUrl: true }
    });

    if (!resource || !isSafeExternalUrl(resource.fileUrl)) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    const cleanName = cleanBaseName(resource);
    const candidateUrls = [resource.fileUrl, cloudinaryRawCandidate(resource.fileUrl)].filter(Boolean);
    let upstream: Response | null = null;

    for (const url of candidateUrls) {
      const response = await fetch(url, { cache: "no-store" }).catch(() => null);
      if (response?.ok) {
        upstream = response;
        break;
      }
    }

    if (!upstream) {
      return NextResponse.json({ error: "Resource is temporarily unavailable." }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = upstream.headers.get("content-disposition");
    const extension =
      extensionFromUrl(resource.fileUrl) ||
      extensionFromContentDisposition(contentDisposition) ||
      contentTypeExtensions[contentTypeKey(contentType)] ||
      "file";
    const filename = `${cleanName}.${extension}`;
    const fileBuffer = await upstream.arrayBuffer();

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(fileBuffer.byteLength),
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Resources are temporarily unavailable. Please try again later." }, { status: 500 });
  }
}
