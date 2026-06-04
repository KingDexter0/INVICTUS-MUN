import type { AdminNote, Registration } from "@prisma/client";

export type RegistrationWithNotes = Registration & { notes?: AdminNote[] };

export function amountForType(type: string) {
  if (type === "International Delegate") return 3500;
  if (type === "International Press") return 1200;
  return 1500;
}

export function serializeRegistration(registration: RegistrationWithNotes) {
  return {
    ...registration,
    createdAt: registration.createdAt.toISOString(),
    updatedAt: registration.updatedAt.toISOString(),
    notes: registration.notes?.map((note) => ({
      ...note,
      createdAt: note.createdAt.toISOString()
    }))
  };
}

export function publicIdFromCount(count: number) {
  return `INV-2026-${String(count + 1).padStart(3, "0")}`;
}

export function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export const allowedPaymentTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const allowedPaymentExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
export const maxPaymentProofBytes = 5 * 1024 * 1024;

export function validatePaymentProofFile(file: File | null) {
  if (!file || file.size === 0) return null;

  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = allowedPaymentExtensions.some((extension) => lowerName.endsWith(extension));
  const hasAllowedType = allowedPaymentTypes.includes(file.type);

  if (!hasAllowedType && !hasAllowedExtension) {
    return "Payment proof must be a JPG, JPEG, PNG, WEBP, or PDF file.";
  }

  if (file.size > maxPaymentProofBytes) {
    return "Payment proof must be 5MB or smaller.";
  }

  return null;
}
