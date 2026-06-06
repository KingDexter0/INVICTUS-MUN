import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

type UploadResult = {
  secure_url: string;
  public_id: string;
};

export async function uploadPaymentProof(file: File | null): Promise<UploadResult | null> {
  if (!file || file.size === 0) {
    return null;
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary is not configured. Add Cloudinary credentials or submit without a payment screenshot.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "invictus-mun/payment-proofs",
        resource_type: "auto"
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed."));
          return;
        }

        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );

    stream.end(bytes);
  });
}

export async function uploadResourceFile(file: File | null): Promise<UploadResult | null> {
  if (!file || file.size === 0) {
    return null;
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary is not configured.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const originalName = cleanUploadFilename(file.name || "invictus-resource");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "invictus-mun/resources",
        resource_type: "raw",
        use_filename: true,
        unique_filename: true,
        filename_override: originalName
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed."));
          return;
        }

        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );

    stream.end(bytes);
  });
}

function cleanUploadFilename(value: string) {
  return value
    .replace(/[\\/]/g, "-")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "invictus-resource";
}

export async function uploadEbPhoto(file: File | null): Promise<UploadResult | null> {
  if (!file || file.size === 0) {
    return null;
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary is not configured.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "invictus-mun/eb-profiles",
        resource_type: "image"
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed."));
          return;
        }

        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );

    stream.end(bytes);
  });
}

export async function deleteCloudinaryFile(publicId: string) {
  if (!publicId) return;
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary is not configured.");
  }

  await cloudinary.uploader.destroy(publicId, { resource_type: "raw" }).catch(async () => {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  });
}
