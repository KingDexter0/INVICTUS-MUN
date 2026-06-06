import { prisma } from "./prisma";

export interface NormalizedRegistration {
  found: boolean;
  targetType: "individual" | "delegationDelegate" | "legacy";
  id: string;
  publicId: string;
  trackingToken: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  school: string | null;
  delegationName?: string | null;
  coTeacherName?: string | null;
  coTeacherPhone?: string | null;
  coTeacherEmail?: string | null;
  committee: string | null;
  portfolio: string | null;
  allotment: string | null;
  paymentStatus: string | null;
  registrationStatus: string | null;
  allotmentStatus: string | null;
  checkedIn: boolean;
  checkedInAt: Date | null;
  checkedInBy?: string | null;
  certificateIssued: boolean;
  certificateUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function resolveRegistrationByToken(token: string): Promise<NormalizedRegistration | null> {
  const cleanToken = token.trim();
  if (!cleanToken) return null;

  // 1. Try checking IndividualRegistration first
  const individual = await prisma.individualRegistration.findFirst({
    where: {
      OR: [
        { trackingToken: cleanToken },
        { publicId: cleanToken },
        { id: cleanToken }
      ]
    }
  });

  if (individual) {
    return {
      found: true,
      targetType: "individual",
      id: individual.id,
      publicId: individual.publicId,
      trackingToken: individual.trackingToken || individual.publicId,
      fullName: individual.name,
      email: individual.email,
      phone: individual.phone,
      school: individual.institution,
      committee: individual.allottedCommittee || individual.committee1 || null,
      portfolio: individual.allottedPortfolio || individual.portfolio1 || null,
      allotment: individual.allottedPortfolio || individual.portfolio1 || null,
      paymentStatus: individual.paymentStatus,
      registrationStatus: individual.registrationStatus,
      allotmentStatus: individual.allotmentStatus,
      checkedIn: individual.checkedIn,
      checkedInAt: individual.checkedInAt,
      checkedInBy: individual.checkedInBy,
      certificateIssued: individual.certificateReleased,
      certificateUrl: individual.certificateUrl,
      createdAt: individual.createdAt,
      updatedAt: individual.updatedAt,
      delegationName: individual.delegationName
    };
  }

  // 2. Next check DelegationDelegate
  const delegate = await prisma.delegationDelegate.findFirst({
    where: {
      OR: [
        { trackingToken: cleanToken },
        { publicId: cleanToken },
        { id: cleanToken }
      ]
    },
    include: { delegation: true }
  });

  if (delegate) {
    return {
      found: true,
      targetType: "delegationDelegate",
      id: delegate.id,
      publicId: delegate.publicId,
      trackingToken: delegate.trackingToken || delegate.publicId,
      fullName: delegate.name,
      email: delegate.email || null,
      phone: delegate.phone || null,
      school: delegate.delegation.institution || null,
      delegationName: delegate.delegation.delegationName,
      coTeacherName: delegate.delegation.coTeacherName,
      coTeacherPhone: delegate.delegation.coTeacherPhone,
      coTeacherEmail: delegate.delegation.coTeacherEmail,
      committee: delegate.allottedCommittee || delegate.committee1 || null,
      portfolio: delegate.allottedPortfolio || delegate.portfolio1 || null,
      allotment: delegate.allottedPortfolio || delegate.portfolio1 || null,
      paymentStatus: delegate.delegation.paymentStatus,
      registrationStatus: delegate.delegation.registrationStatus,
      allotmentStatus: delegate.allotmentStatus,
      checkedIn: delegate.checkedIn,
      checkedInAt: delegate.checkedInAt,
      checkedInBy: delegate.checkedInBy,
      certificateIssued: delegate.certificateReleased,
      certificateUrl: delegate.certificateUrl,
      createdAt: delegate.createdAt,
      updatedAt: delegate.updatedAt
    };
  }

  // 3. Fallback: Legacy Registration lookup if present
  try {
    const legacy = await prisma.registration.findFirst({
      where: {
        OR: [
          { publicId: cleanToken },
          { id: cleanToken }
        ]
      }
    });

    if (legacy) {
      return {
        found: true,
        targetType: "legacy",
        id: legacy.id,
        publicId: legacy.publicId,
        trackingToken: legacy.publicId,
        fullName: legacy.name,
        email: legacy.email,
        phone: legacy.phone,
        school: legacy.institution,
        committee: legacy.allottedCommittee || legacy.committee1 || null,
        portfolio: legacy.allottedPortfolio || legacy.portfolio1 || null,
        allotment: legacy.allottedPortfolio || legacy.portfolio1 || null,
        paymentStatus: legacy.paymentStatus,
        registrationStatus: legacy.registrationStatus,
        allotmentStatus: legacy.allotmentStatus,
        checkedIn: legacy.checkedIn,
        checkedInAt: legacy.checkedInAt,
        checkedInBy: legacy.checkedInBy,
        certificateIssued: legacy.certificateReleased,
        certificateUrl: legacy.certificateUrl,
        createdAt: legacy.createdAt,
        updatedAt: legacy.updatedAt,
        delegationName: legacy.delegationName
      };
    }
  } catch (err) {
    // Legacy Registration table might not exist or be empty
  }

  return null;
}
