import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assertAdmin } from "../../../lib/admin";
import { sendRegistrationEmail } from "../../../lib/email";
import { prisma } from "../../../lib/prisma";
import { uploadPaymentProof } from "../../../lib/cloudinary";
import {
  calculateRegistrationAmount,
  publicIdFromCount,
  serializeIndividualRegistration,
  serializeDelegationRegistration
} from "../../../lib/registrations";

export const dynamic = "force-dynamic";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function numberOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function validateRegistration(formData: FormData) {
  const errors: string[] = [];
  const registrationType = text(formData, "registrationType") || "individual";

  if (registrationType === "individual") {
    const email = text(formData, "email");
    const phone = text(formData, "phone");
    const name = text(formData, "name");
    const age = numberOrNull(formData, "age");
    const dob = text(formData, "dob");
    const gender = text(formData, "gender");
    const institution = text(formData, "institution");
    const gradeYear = text(formData, "gradeYear");
    const committee1 = text(formData, "committee1");
    const portfolio1 = text(formData, "portfolio1");
    const committee2 = text(formData, "committee2");
    const portfolio2 = text(formData, "portfolio2");
    const city = text(formData, "city");

    if (name.length < 2) errors.push("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter a valid email address.");
    if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) errors.push("Enter a valid phone number.");
    if (!age || age <= 0) errors.push("Enter a valid age.");
    if (!dob) errors.push("Enter your date of birth.");
    if (!gender) errors.push("Select your gender.");
    if (!institution) errors.push("Enter your institution.");
    if (!gradeYear) errors.push("Enter your grade/year.");
    if (!committee1) errors.push("Select committee preference 1.");
    if (!portfolio1) errors.push("Enter portfolio preference 1.");
    if (!committee2) errors.push("Select committee preference 2.");
    if (!portfolio2) errors.push("Enter portfolio preference 2.");
    if (!city) errors.push("Enter your city of residence.");

    const isPartOfDelegation = text(formData, "isPartOfDelegation") === "Yes";
    if (isPartOfDelegation && !text(formData, "delegationName")) {
      errors.push("Enter your delegation name.");
    }
  } else if (registrationType === "delegation") {
    const delegationName = text(formData, "delegationName");
    const coTeacherName = text(formData, "coTeacherName");
    const coTeacherPhone = text(formData, "coTeacherPhone");
    const coTeacherEmail = text(formData, "coTeacherEmail");
    const city = text(formData, "city");
    const totalDelegates = numberOrNull(formData, "totalDelegates");
    const delegateNames = text(formData, "delegateNames");

    if (!delegationName) errors.push("Enter delegation name.");
    if (!coTeacherName) errors.push("Enter coordinating teacher / head delegate name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coTeacherEmail)) errors.push("Enter a valid co-ordinating teacher email.");
    if (!/^[0-9+\-\s()]{7,20}$/.test(coTeacherPhone)) errors.push("Enter a valid co-ordinating teacher phone number.");
    if (!city) errors.push("Enter city of residence.");
    if (!totalDelegates || totalDelegates < 10) {
      errors.push("Minimum delegation size is 10 delegates. Please use Individual Delegate Registration or contact the secretariat.");
    }
    if (!delegateNames) errors.push("Enter the names of delegates.");
  } else {
    errors.push("Invalid registration type.");
  }

  return errors;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const errors = validateRegistration(formData);

    if (errors.length) {
      return NextResponse.json(
        { error: "Please fix the highlighted registration details.", details: errors },
        { status: 400 }
      );
    }

    const registrationType = text(formData, "registrationType") || "individual";
    const type = text(formData, "type") || (registrationType === "delegation" ? "Group Delegation" : "Individual Delegate");
    
    // Count both tables to generate next public ID
    const countInd = await prisma.individualRegistration.count();
    const countDel = await prisma.delegationRegistration.count();
    const count = countInd + countDel;
    const publicId = publicIdFromCount(count);

    // File upload logic for screenshot
    const screenshotFile = (formData.get("paymentScreenshot") || formData.get("file") || formData.get("paymentProof")) as File | null;
    let screenshotUrl = null;
    let screenshotPublicId = null;
    if (screenshotFile && screenshotFile.size > 0) {
      if (!screenshotFile.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Payment proof must be a valid image screenshot (PNG, JPG, WEBP, etc.). PDFs are no longer accepted." },
          { status: 400 }
        );
      }
      const uploadResult = await uploadPaymentProof(screenshotFile).catch(err => {
        console.error("Cloudinary upload error:", err);
        return null;
      });
      if (uploadResult) {
        screenshotUrl = uploadResult.secure_url;
        screenshotPublicId = uploadResult.public_id;
      }
    }

    const accommodationVal = text(formData, "accommodation") || "No";
    const accommodationRequired = accommodationVal === "Yes";
    const totalDelegatesVal = numberOrNull(formData, "totalDelegates") || 1;

    const calculatedAmount = calculateRegistrationAmount(
      registrationType,
      type,
      accommodationRequired,
      totalDelegatesVal
    );

    const isIndividual = registrationType === "individual";
    let savedRegistration: any;

    if (isIndividual) {
      const email = text(formData, "email");
      const phone = text(formData, "phone");
      const name = text(formData, "name");
      const institution = text(formData, "institution") || null;
      const city = text(formData, "city") || null;

      savedRegistration = await prisma.individualRegistration.create({
        data: {
          publicId,
          name,
          email,
          phone,
          institution,
          city,
          committee1: text(formData, "committee1"),
          portfolio1: text(formData, "portfolio1") || null,
          committee2: text(formData, "committee2") || null,
          portfolio2: text(formData, "portfolio2") || null,
          age: numberOrNull(formData, "age"),
          dob: text(formData, "dob") || null,
          gender: text(formData, "gender") || null,
          gradeYear: text(formData, "gradeYear") || null,
          isPartOfDelegation: text(formData, "isPartOfDelegation") === "Yes",
          delegationName: text(formData, "delegationName") || null,
          refPerson: text(formData, "refPerson") || null,
          muns: numberOrNull(formData, "muns"),
          awards: numberOrNull(formData, "awards"),
          experience: text(formData, "experience") || null,
          utr: text(formData, "utr") || null,
          amount: calculatedAmount,
          paymentProofUrl: screenshotUrl,
          paymentProofPublicId: screenshotPublicId,
          accommodation: accommodationVal,
          transport: text(formData, "transport") || null,
          arrivalCity: text(formData, "arrivalCity") || null,
          requirements: text(formData, "requirements") || null,
          paymentStatus: screenshotUrl ? "Review" : "Pending",
          registrationType,
          accommodationRequired,
          paymentScreenshotUrl: screenshotUrl,
          paymentScreenshotPublicId: screenshotPublicId,
          totalAmountPaid: calculatedAmount
        }
      });

      void sendRegistrationEmail({
        to: savedRegistration.email,
        name: savedRegistration.name,
        publicId: savedRegistration.publicId,
        heading: "Registration submitted",
        action: "Your Invictus MUN registration has been submitted successfully.",
        dashboardPath: `/dashboard?id=${encodeURIComponent(savedRegistration.publicId)}`,
        details: [
          ["Registration type", savedRegistration.registrationType],
          ["Role/Committee", savedRegistration.committee1 || "Delegate"],
          ["Payment status", savedRegistration.paymentStatus],
          ["Registration status", savedRegistration.registrationStatus]
        ]
      });

      return NextResponse.json({ registration: serializeIndividualRegistration(savedRegistration), id: savedRegistration.publicId });

    } else {
      const delegationName = text(formData, "delegationName");
      const coTeacherName = text(formData, "coTeacherName");
      const coTeacherEmail = text(formData, "coTeacherEmail");
      const coTeacherPhone = text(formData, "coTeacherPhone");
      const city = text(formData, "city") || null;
      const institution = text(formData, "institution") || null;

      savedRegistration = await prisma.delegationRegistration.create({
        data: {
          publicId,
          delegationName,
          institution,
          coTeacherName,
          coTeacherEmail,
          coTeacherPhone,
          city,
          totalDelegates: totalDelegatesVal,
          amount: calculatedAmount,
          paymentProofUrl: screenshotUrl,
          paymentProofPublicId: screenshotPublicId,
          paymentStatus: screenshotUrl ? "Review" : "Pending",
          registrationType,
          accommodationRequired,
          paymentScreenshotUrl: screenshotUrl,
          paymentScreenshotPublicId: screenshotPublicId,
          totalAmountPaid: calculatedAmount
        }
      });

      // Split delegateNames and create delegation delegate rows
      const delegateNamesStr = text(formData, "delegateNames");
      const names = delegateNamesStr ? delegateNamesStr.split(",").map(n => n.trim()).filter(Boolean) : [];
      
      for (let i = 0; i < names.length; i++) {
        await prisma.delegationDelegate.create({
          data: {
            publicId: `${publicId}-d${i + 1}`,
            delegationId: savedRegistration.id,
            name: names[i]
          }
        });
      }

      void sendRegistrationEmail({
        to: savedRegistration.coTeacherEmail,
        name: savedRegistration.coTeacherName,
        publicId: savedRegistration.publicId,
        heading: "Registration submitted",
        action: "Your Invictus MUN delegation registration has been submitted successfully.",
        dashboardPath: `/dashboard?id=${encodeURIComponent(savedRegistration.publicId)}`,
        details: [
          ["Delegation Name", savedRegistration.delegationName],
          ["Co-ordinating Teacher", savedRegistration.coTeacherName],
          ["Payment status", savedRegistration.paymentStatus],
          ["Registration status", savedRegistration.registrationStatus]
        ]
      });

      return NextResponse.json({ registration: serializeDelegationRegistration(savedRegistration), id: savedRegistration.publicId });
    }

  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A registration ID conflict occurred. Please submit the form again." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Registration could not be saved right now. Please try again in a minute." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    assertAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const paymentStatus = searchParams.get("paymentStatus")?.trim();
    const registrationStatus = searchParams.get("registrationStatus")?.trim();
    const registrationType = searchParams.get("registrationType")?.trim();

    // 1. Fetch from IndividualRegistration
    const indWhere: Prisma.IndividualRegistrationWhereInput = {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(registrationStatus ? { registrationStatus } : {}),
      ...(search
        ? {
            OR: [
              { publicId: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { institution: { contains: search, mode: "insensitive" } },
              { committee1: { contains: search, mode: "insensitive" } },
              { utr: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const individuals = await prisma.individualRegistration.findMany({
      where: indWhere,
      include: { notes: { orderBy: { createdAt: "desc" } } }
    });

    // 2. Fetch from DelegationRegistration
    const delWhere: Prisma.DelegationRegistrationWhereInput = {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(registrationStatus ? { registrationStatus } : {}),
      ...(search
        ? {
            OR: [
              { publicId: { contains: search, mode: "insensitive" } },
              { delegationName: { contains: search, mode: "insensitive" } },
              { coTeacherEmail: { contains: search, mode: "insensitive" } },
              { coTeacherPhone: { contains: search, mode: "insensitive" } },
              { institution: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const delegations = await prisma.delegationRegistration.findMany({
      where: delWhere,
      include: { notes: { orderBy: { createdAt: "desc" } }, delegates: true }
    });

    // Normalize to legacy format so dashboard stats & global operations don't break
    const normalizedIndividuals = individuals.map(item => ({
      ...serializeIndividualRegistration(item),
      registrationType: "individual"
    }));

    const normalizedDelegations = delegations.map(item => ({
      ...serializeDelegationRegistration(item),
      name: item.delegationName,
      email: item.coTeacherEmail,
      phone: item.coTeacherPhone,
      type: "Group Delegation",
      committee1: "Group Delegation",
      registrationType: "delegation"
    }));

    let combined = [...normalizedIndividuals, ...normalizedDelegations];

    // Apply registrationType filter if active
    if (registrationType === "individual") {
      combined = normalizedIndividuals;
    } else if (registrationType === "delegation") {
      combined = normalizedDelegations;
    }

    // Sort combined by createdAt desc
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ registrations: combined });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not fetch registrations." }, { status: 500 });
  }
}
