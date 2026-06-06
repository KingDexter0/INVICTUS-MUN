import { NextResponse } from "next/server";
import { assertAdmin } from "../../../lib/admin";
import { uploadResourceImageFile } from "../../../lib/cloudinary";
import { sendResourceEmail } from "../../../lib/mail";
import { prisma } from "../../../lib/prisma";
import { operationsEmitter } from "../../../lib/events";

export const dynamic = "force-dynamic";

function serializeResource(resource: {
  id: string;
  title: string;
  description: string | null;
  category: string;
  accessLevel: string;
  fileUrl: string;
  filePublicId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...resource,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString()
  };
}

export async function GET() {
  try {
    const resources = await prisma.resource.findMany({
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ resources: resources.map(serializeResource) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load resources." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertAdmin();
    const formData = await request.formData();
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const accessLevel = String(formData.get("accessLevel") || "").trim();
    const file = formData.get("file");

    if (title.length < 3) {
      return NextResponse.json({ error: "Resource title must be at least 3 characters." }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: "Choose a resource category." }, { status: 400 });
    }
    if (!accessLevel) {
      return NextResponse.json({ error: "Choose a resource access level." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Upload a resource file." }, { status: 400 });
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    const isDoc =
      file.type === "application/msword" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".doc") ||
      file.name.toLowerCase().endsWith(".docx");

    if (!isPdf && !isDoc) {
      return NextResponse.json(
        { error: "Only PDF and DOC/DOCX files are supported." },
        { status: 400 }
      );
    }

    let fileUrl: string;
    let filePublicId: string;

    // Upload PDF or DOC/DOCX to Vercel Blob
    const { put } = await import("@vercel/blob");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const blob = await put(`resources/${Date.now()}-${safeName}`, file, {
      access: "public",
      contentType: file.type || (isPdf ? "application/pdf" : "application/msword")
    });
    fileUrl = blob.url;
    filePublicId = blob.pathname;

    const resource = await prisma.resource.create({
      data: {
        title,
        description: description || null,
        category,
        accessLevel,
        fileUrl,
        filePublicId
      }
    });

    const recipients = await prisma.registration.findMany({
      where: {
        ...(accessLevel === "Approved" ? { registrationStatus: "Approved" } : {}),
        ...(accessLevel === "Allotted" ? { allotmentStatus: "Allotted" } : {})
      },
      select: { email: true, name: true, publicId: true },
      take: 500
    });

    void Promise.all(
      recipients.map((recipient) =>
        sendResourceEmail({
          to: recipient.email,
          name: recipient.name,
          title: resource.title,
          category: resource.category,
          accessLevel: resource.accessLevel,
          dashboardPath: `/dashboard?id=${encodeURIComponent(recipient.publicId)}`
        })
      )
    );

    operationsEmitter.emit("update", {
      type: "operations:refresh-needed",
      data: { reason: "resource-uploaded" }
    });

    return NextResponse.json({ resource: serializeResource(resource) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Cloudinary is not configured")) {
      return NextResponse.json({ error: "Resource upload is not configured. Add Cloudinary credentials before uploading files." }, { status: 503 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not save resource." }, { status: 500 });
  }
}
