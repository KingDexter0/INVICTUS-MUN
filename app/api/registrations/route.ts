import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assertAdmin } from "../../../lib/admin";
import { sendRegistrationEmail } from "../../../lib/email";
import { prisma } from "../../../lib/prisma";
import { uploadPaymentProof } from "../../../lib/cloudinary";
import {
  calculateRegistrationAmount,
  publicIdFromCount,
  serializeRegistration
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
    const count = await prisma.registration.count();
    
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

    // Prepare fields based on type
    const isIndividual = registrationType === "individual";
    const name = isIndividual ? text(formData, "name") : text(formData, "delegationName");
    const email = isIndividual ? text(formData, "email") : text(formData, "coTeacherEmail");
    const phone = isIndividual ? text(formData, "phone") : text(formData, "coTeacherPhone");
    const institution = text(formData, "institution") || null;
    const city = text(formData, "city") || null;
    
    const registration = await prisma.registration.create({
      data: {
        publicId: publicIdFromCount(count),
        name,
        email,
        phone,
        institution,
        type,
        committee1: isIndividual ? text(formData, "committee1") : "Group Delegation",
        committee2: isIndividual ? (text(formData, "committee2") || null) : null,
        portfolio1: isIndividual ? (text(formData, "portfolio1") || null) : null,
        muns: isIndividual ? numberOrNull(formData, "muns") : null,
        awards: isIndividual ? numberOrNull(formData, "awards") : null,
        experience: isIndividual ? (text(formData, "experience") || null) : null,
        utr: text(formData, "utr") || null,
        amount: calculatedAmount,
        paymentProofUrl: screenshotUrl,
        paymentProofPublicId: screenshotPublicId,
        accommodation: accommodationVal,
        transport: text(formData, "transport") || null,
        arrivalCity: text(formData, "arrivalCity") || null,
        requirements: text(formData, "requirements") || null,
        paymentStatus: screenshotUrl ? "Review" : "Pending", // Automatically move to Review if screenshot uploaded
        
        // New columns
        registrationType,
        accommodationRequired,
        paymentScreenshotUrl: screenshotUrl,
        paymentScreenshotPublicId: screenshotPublicId,
        totalAmountPaid: calculatedAmount,
        age: isIndividual ? numberOrNull(formData, "age") : null,
        dob: isIndividual ? text(formData, "dob") : null,
        gender: isIndividual ? text(formData, "gender") : null,
        gradeYear: isIndividual ? text(formData, "gradeYear") : null,
        portfolio2: isIndividual ? text(formData, "portfolio2") : null,
        city,
        isPartOfDelegation: isIndividual ? (text(formData, "isPartOfDelegation") === "Yes") : false,
        delegationName: text(formData, "delegationName") || null,
        refPerson: isIndividual ? text(formData, "refPerson") : null,
        coTeacherName: !isIndividual ? text(formData, "coTeacherName") : null,
        coTeacherPhone: !isIndividual ? text(formData, "coTeacherPhone") : null,
        coTeacherEmail: !isIndividual ? text(formData, "coTeacherEmail") : null,
        totalDelegates: !isIndividual ? totalDelegatesVal : null,
        delegateNames: !isIndividual ? text(formData, "delegateNames") : null
      }
    });

    void sendRegistrationEmail({
      to: registration.email,
      name: registration.name,
      publicId: registration.publicId,
      heading: "Registration submitted",
      action: "Your Invictus MUN registration has been submitted successfully. Please open your dashboard to track your verification status.",
      dashboardPath: `/dashboard?id=${encodeURIComponent(registration.publicId)}`,
      details: [
        ["Registration type", registration.type],
        ["Role/Delegation", registration.registrationType === "delegation" ? "Delegation Group" : (registration.committee1 || "Delegate")],
        ["Payment status", registration.paymentStatus],
        ["Registration status", registration.registrationStatus]
      ]
    });

    return NextResponse.json({ registration: serializeRegistration(registration), id: registration.publicId });
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

    const where: Prisma.RegistrationWhereInput = {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(registrationStatus ? { registrationStatus } : {}),
      ...(registrationType ? { registrationType } : {}),
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

    const registrations = await prisma.registration.findMany({
      where,
      include: { notes: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ registrations: registrations.map(serializeRegistration) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not fetch registrations." }, { status: 500 });
  }
}
