import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { assertAdmin } from "../../../lib/admin";
import { sendResourceEmail } from "../../../lib/mail";
import { prisma } from "../../../lib/prisma";
import { operationsEmitter } from "../../../lib/events";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"];

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

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const hasAllowedType = ALLOWED_TYPES.has(file.type);
    const hasAllowedExt = ALLOWED_EXTENSIONS.includes(ext);

    if (!hasAllowedType && !hasAllowedExt) {
      return NextResponse.json(
        { error: "Only PDF, DOC/DOCX, PPT/PPTX, and XLS/XLSX files are supported." },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob (public read, authenticated write)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const blob = await put(`resources/${Date.now()}-${safeName}`, file, {
      access: "public",
      contentType: file.type || "application/octet-stream",
      addRandomSuffix: false
    });

    const resource = await prisma.resource.create({
      data: {
        title,
        description: description || null,
        category,
        accessLevel,
        fileUrl: blob.url,
        filePublicId: blob.pathname
      }
    });

    // Notify eligible delegates across both tables (fire-and-forget)
    void notifyEligibleDelegates(resource.title, resource.category, resource.accessLevel);

    operationsEmitter.emit("update", {
      type: "operations:refresh-needed",
      data: { reason: "resource-uploaded" }
    });

    return NextResponse.json({ resource: serializeResource(resource) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not save resource." }, { status: 500 });
  }
}

/**
 * Sends resource notification emails to eligible individuals and delegates
 * based on the resource's access level. Runs fire-and-forget.
 */
async function notifyEligibleDelegates(title: string, category: string, accessLevel: string) {
  try {
    // Build access-level filters
    const individualWhere: Record<string, unknown> = {};
    const delegateWhere: Record<string, unknown> = {};

    if (accessLevel === "Approved") {
      individualWhere.registrationStatus = "Approved";
      delegateWhere.delegation = { registrationStatus: "Approved" };
    } else if (accessLevel === "Allotted") {
      individualWhere.allotmentStatus = "Allotted";
      delegateWhere.allotmentStatus = "Allotted";
    }
    // "Public" and "Registered" → no extra filter, send to all

    const [individuals, delegates] = await Promise.all([
      prisma.individualRegistration.findMany({
        where: { email: { not: "" }, ...individualWhere },
        select: { email: true, name: true, publicId: true },
        take: 500
      }),
      prisma.delegationDelegate.findMany({
        where: {
          email: { not: null },
          ...delegateWhere
        },
        select: { email: true, name: true, publicId: true },
        take: 500
      })
    ]);

    const recipients: Array<{ email: string; name: string; publicId: string }> = [
      ...individuals,
      // DelegationDelegate.email is nullable
      ...delegates.filter((d) => Boolean(d.email)).map((d) => ({
        email: d.email!,
        name: d.name,
        publicId: d.publicId
      }))
    ];

    await Promise.allSettled(
      recipients.map((recipient) =>
        sendResourceEmail({
          to: recipient.email,
          name: recipient.name,
          title,
          category,
          accessLevel,
          dashboardPath: `/dashboard?id=${encodeURIComponent(recipient.publicId)}`
        })
      )
    );
  } catch (err) {
    console.error("[resource notify] Failed to send resource emails:", err);
  }
}
