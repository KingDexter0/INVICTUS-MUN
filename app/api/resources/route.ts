import { NextResponse } from "next/server";
import { assertAdmin } from "../../../lib/admin";
import { uploadResourceFile } from "../../../lib/cloudinary";
import { prisma } from "../../../lib/prisma";

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

    const upload = await uploadResourceFile(file);
    if (!upload) {
      return NextResponse.json({ error: "Resource file could not be uploaded." }, { status: 500 });
    }

    const resource = await prisma.resource.create({
      data: {
        title,
        description: description || null,
        category,
        accessLevel,
        fileUrl: upload.secure_url,
        filePublicId: upload.public_id
      }
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
