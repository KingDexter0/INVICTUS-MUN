import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assertAdmin } from "../../../lib/admin";
import { sendRegistrationEmail } from "../../../lib/mail";
import { prisma } from "../../../lib/prisma";
import { uploadPaymentProof } from "../../../lib/cloudinary";
import { ensureUniqueTrackingToken } from "../../../lib/tracking-token";
import {
  calculateRegistrationAmount,
  publicIdFromCount,
  serializeIndividualRegistration,
  serializeDelegationRegistration
} from "../../../lib/registrations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let body: any = {};
    let screenshotUrl: string | null = null;
    let screenshotPublicId: string | null = null;

    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      // Extract fields from FormData
      body.registrationType = String(formData.get("registrationType") || "").trim();
      body.type = String(formData.get("type") || "").trim();
      body.name = String(formData.get("name") || "").trim();
      body.email = String(formData.get("email") || "").trim();
      body.phone = String(formData.get("phone") || "").trim();
      body.age = formData.get("age") ? Number(formData.get("age")) : null;
      body.dob = String(formData.get("dob") || "").trim();
      body.gender = String(formData.get("gender") || "").trim();
      body.institution = String(formData.get("institution") || "").trim();
      body.gradeYear = String(formData.get("gradeYear") || "").trim();
      body.committee1 = String(formData.get("committee1") || "").trim();
      body.portfolio1 = String(formData.get("portfolio1") || "").trim();
      body.committee2 = String(formData.get("committee2") || "").trim();
      body.portfolio2 = String(formData.get("portfolio2") || "").trim();
      body.city = String(formData.get("city") || "").trim();
      body.isPartOfDelegation = String(formData.get("isPartOfDelegation") || "").trim();
      body.delegationName = String(formData.get("delegationName") || "").trim();
      body.refPerson = String(formData.get("refPerson") || "").trim();
      body.muns = formData.get("muns") ? Number(formData.get("muns")) : null;
      body.awards = formData.get("awards") ? Number(formData.get("awards")) : null;
      body.experience = String(formData.get("experience") || "").trim();
      body.utr = String(formData.get("utr") || "").trim();
      body.accommodation = String(formData.get("accommodation") || "").trim();
      body.transport = String(formData.get("transport") || "").trim();
      body.arrivalCity = String(formData.get("arrivalCity") || "").trim();
      body.requirements = String(formData.get("requirements") || "").trim();
      body.coTeacherName = String(formData.get("coTeacherName") || "").trim();
      body.coTeacherEmail = String(formData.get("coTeacherEmail") || "").trim();
      body.coTeacherPhone = String(formData.get("coTeacherPhone") || "").trim();
      body.totalDelegates = formData.get("totalDelegates") ? Number(formData.get("totalDelegates")) : null;
      
      // delegates parser
      const delegatesStr = formData.get("delegates");
      if (delegatesStr) {
        try {
          body.delegates = JSON.parse(String(delegatesStr));
        } catch {
          body.delegates = [];
        }
      } else {
        const delegateNamesStr = String(formData.get("delegateNames") || "").trim();
        body.delegates = delegateNamesStr
          ? delegateNamesStr.split(",").map(n => ({ name: n.trim() })).filter(d => Boolean(d.name))
          : [];
      }

      // Cloudinary File Upload for payment screenshot
      const screenshotFile = (formData.get("paymentScreenshot") || formData.get("file") || formData.get("paymentProof")) as File | null;
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
    }

    // Server-side logging
    console.log(`[NEW REGISTRATION REQUEST] content-type=${contentType}, isDelegation=${body.registrationType === "delegation" || Boolean(body.delegationName)}`);

    // Registration type detection fallback
    let registrationType = body.registrationType;
    if (!registrationType) {
      if (body.delegationName || (body.delegates && body.delegates.length > 1) || body.coTeacherName || body.coTeacherEmail) {
        registrationType = "delegation";
      } else {
        registrationType = "individual";
      }
    }

    // Validation
    const errors: string[] = [];
    if (registrationType === "individual") {
      if (!body.name || body.name.trim().length < 2) errors.push("Enter your full name.");
      if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push("Enter a valid email address.");
      if (!body.phone || !/^[0-9+\-\s()]{7,20}$/.test(body.phone)) errors.push("Enter a valid phone number.");
      if (!body.age || body.age <= 0) errors.push("Enter a valid age.");
      if (!body.dob) errors.push("Enter your date of birth.");
      if (!body.gender) errors.push("Select your gender.");
      if (!body.institution) errors.push("Enter your institution.");
      if (!body.gradeYear) errors.push("Enter your grade/year.");
      if (!body.committee1) errors.push("Select committee preference 1.");
      if (!body.portfolio1) errors.push("Enter portfolio preference 1.");
      if (!body.city) errors.push("Enter your city of residence.");
    } else {
      if (!body.delegationName) errors.push("Enter delegation name.");
      if (!body.coTeacherName) errors.push("Enter coordinating teacher / head delegate name.");
      if (!body.coTeacherEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.coTeacherEmail)) errors.push("Enter a valid co-ordinating teacher email.");
      if (!body.coTeacherPhone || !/^[0-9+\-\s()]{7,20}$/.test(body.coTeacherPhone)) errors.push("Enter a valid co-ordinating teacher phone number.");
      if (!body.city) errors.push("Enter city of residence.");
      if (!body.delegates || body.delegates.length === 0) errors.push("Enter the names of delegates.");
    }

    if (errors.length) {
      return NextResponse.json(
        { error: "Please fix the highlighted registration details.", details: errors },
        { status: 400 }
      );
    }

    // Count both tables to generate next public ID
    const countInd = await prisma.individualRegistration.count();
    const countDel = await prisma.delegationRegistration.count();
    const count = countInd + countDel;
    const publicId = publicIdFromCount(count);

    const type = body.type || (registrationType === "delegation" ? "Group Delegation" : "Individual Delegate");
    const accommodationVal = body.accommodation || "No";
    const accommodationRequired = accommodationVal === "Yes";
    const delegatesCount = registrationType === "delegation" ? (body.delegates?.length || body.totalDelegates || 10) : 1;

    const calculatedAmount = calculateRegistrationAmount(
      registrationType,
      type,
      accommodationRequired,
      delegatesCount
    );

    if (registrationType === "individual") {
      const trackingToken = await ensureUniqueTrackingToken();
      const savedRegistration = await prisma.individualRegistration.create({
        data: {
          publicId,
          trackingToken,
          name: body.name,
          email: body.email,
          phone: body.phone,
          institution: body.institution || null,
          city: body.city || null,
          committee1: body.committee1,
          portfolio1: body.portfolio1 || null,
          committee2: body.committee2 || null,
          portfolio2: body.portfolio2 || null,
          age: body.age || null,
          dob: body.dob || null,
          gender: body.gender || null,
          gradeYear: body.gradeYear || null,
          isPartOfDelegation: body.isPartOfDelegation === "Yes" || body.isPartOfDelegation === true,
          delegationName: body.delegationName || null,
          refPerson: body.refPerson || null,
          muns: body.muns || null,
          awards: body.awards || null,
          experience: body.experience || null,
          utr: body.utr || null,
          amount: calculatedAmount,
          paymentProofUrl: screenshotUrl || body.paymentProofUrl || null,
          paymentProofPublicId: screenshotPublicId || body.paymentProofPublicId || null,
          accommodation: accommodationVal,
          transport: body.transport || null,
          arrivalCity: body.arrivalCity || null,
          requirements: body.requirements || null,
          paymentStatus: (screenshotUrl || body.paymentProofUrl) ? "Review" : "Pending",
          registrationType,
          accommodationRequired,
          paymentScreenshotUrl: screenshotUrl || body.paymentScreenshotUrl || null,
          paymentScreenshotPublicId: screenshotPublicId || body.paymentScreenshotPublicId || null,
          totalAmountPaid: calculatedAmount
        }
      });

      console.log(`[INDIVIDUAL REGISTERED] ID=${savedRegistration.publicId}, Token=${trackingToken}`);

      void sendRegistrationEmail({
        to: savedRegistration.email,
        name: savedRegistration.name,
        publicId: savedRegistration.publicId,
        heading: "Registration submitted",
        action: "Your Invictus MUN registration has been submitted successfully.",
        dashboardPath: `/verify/pass/${encodeURIComponent(trackingToken)}`,
        details: [
          ["Registration type", savedRegistration.registrationType],
          ["Role/Committee", savedRegistration.committee1 || "Delegate"],
          ["Payment status", savedRegistration.paymentStatus],
          ["Registration status", savedRegistration.registrationStatus]
        ]
      }).catch(err => console.error("Email failed on individual registration submit", err));

      return NextResponse.json({
        success: true,
        registrationType: "individual",
        id: savedRegistration.publicId,
        trackingToken,
        statusUrl: `/verify/pass/${trackingToken}`,
        dashboardUrl: `/dashboard?id=${trackingToken}`,
        registration: serializeIndividualRegistration(savedRegistration)
      });
    } else {
      const savedRegistration = await prisma.delegationRegistration.create({
        data: {
          publicId,
          delegationName: body.delegationName,
          institution: body.institution || null,
          coTeacherName: body.coTeacherName,
          coTeacherEmail: body.coTeacherEmail,
          coTeacherPhone: body.coTeacherPhone,
          city: body.city || null,
          totalDelegates: delegatesCount,
          amount: calculatedAmount,
          paymentProofUrl: screenshotUrl || body.paymentProofUrl || null,
          paymentProofPublicId: screenshotPublicId || body.paymentProofPublicId || null,
          paymentStatus: (screenshotUrl || body.paymentProofUrl) ? "Review" : "Pending",
          registrationType,
          accommodationRequired,
          paymentScreenshotUrl: screenshotUrl || body.paymentScreenshotUrl || null,
          paymentScreenshotPublicId: screenshotPublicId || body.paymentScreenshotPublicId || null,
          totalAmountPaid: calculatedAmount
        }
      });

      console.log(`[DELEGATION REGISTERED] ID=${savedRegistration.publicId}, DelegatesCount=${delegatesCount}`);

      const savedDelegates: any[] = [];
      const delegateList = body.delegates || [];

      for (let i = 0; i < delegateList.length; i++) {
        const delData = delegateList[i];
        const trackingToken = await ensureUniqueTrackingToken();
        const delegateRow = await prisma.delegationDelegate.create({
          data: {
            publicId: `${publicId}-d${i + 1}`,
            trackingToken,
            delegationId: savedRegistration.id,
            name: delData.name || delData.fullName,
            email: delData.email || null,
            phone: delData.phone || null,
            originalDelegationName: body.delegationName
          }
        });
        savedDelegates.push({
          id: delegateRow.publicId,
          fullName: delegateRow.name,
          trackingToken,
          statusUrl: `/verify/pass/${trackingToken}`,
          dashboardUrl: `/dashboard?id=${trackingToken}`
        });
      }

      void sendRegistrationEmail({
        to: savedRegistration.coTeacherEmail,
        name: savedRegistration.coTeacherName,
        publicId: savedRegistration.publicId,
        heading: "Registration submitted",
        action: "Your Invictus MUN delegation registration has been submitted successfully.",
        dashboardPath: `/verify/pass/${encodeURIComponent(savedRegistration.publicId)}`,
        details: [
          ["Delegation Name", savedRegistration.delegationName],
          ["Co-ordinating Teacher", savedRegistration.coTeacherName],
          ["Payment status", savedRegistration.paymentStatus],
          ["Registration status", savedRegistration.registrationStatus]
        ]
      }).catch(err => console.error("Email failed on delegation registration submit", err));

      return NextResponse.json({
        success: true,
        registrationType: "delegation",
        delegationId: savedRegistration.publicId,
        delegateCount: savedDelegates.length,
        delegates: savedDelegates,
        registration: serializeDelegationRegistration(savedRegistration)
      });
    }
  } catch (error) {
    console.error("Registration failed:", error);
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

