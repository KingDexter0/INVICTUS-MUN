import type {
  AdminNote,
  Registration,
  IndividualRegistration,
  IndividualAdminNote,
  DelegationRegistration,
  DelegationAdminNote,
  DelegationDelegate,
  DelegateAdminNote
} from "@prisma/client";

export type RegistrationWithNotes = Registration & { notes?: AdminNote[] };
export type IndividualRegistrationWithNotes = IndividualRegistration & { notes?: IndividualAdminNote[] };
export type DelegationRegistrationWithNotes = DelegationRegistration & { notes?: DelegationAdminNote[] };
export type DelegationDelegateWithNotes = DelegationDelegate & { notes?: DelegateAdminNote[] };

export function calculateRegistrationAmount(
  registrationType: string,
  type: string,
  accommodationRequired: boolean,
  totalDelegates: number = 1
): number {
  if (registrationType === "delegation") {
    const count = totalDelegates >= 10 ? totalDelegates : 10; // safety fallback
    if (count >= 20) {
      return count * (accommodationRequired ? 4900 : 1900);
    }
    return count * (accommodationRequired ? 5000 : 2000);
  }

  // Individual
  if (accommodationRequired) {
    return 5100;
  }
  if (type === "International Delegate") return 3500;
  if (type === "International Press") return 1200;
  return 2100;
}

export function amountForType(type: string, accommodation?: string | null) {
  return calculateRegistrationAmount("individual", type, accommodation === "Yes");
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

export function serializeIndividualRegistration(registration: IndividualRegistrationWithNotes) {
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

export function serializeDelegationRegistration(delegation: DelegationRegistrationWithNotes) {
  return {
    ...delegation,
    createdAt: delegation.createdAt.toISOString(),
    updatedAt: delegation.updatedAt.toISOString(),
    notes: delegation.notes?.map((note) => ({
      ...note,
      createdAt: note.createdAt.toISOString()
    }))
  };
}

export function serializeDelegationDelegate(delegate: DelegationDelegateWithNotes) {
  return {
    ...delegate,
    createdAt: delegate.createdAt.toISOString(),
    updatedAt: delegate.updatedAt.toISOString(),
    notes: delegate.notes?.map((note) => ({
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
