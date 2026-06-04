import { NextResponse } from "next/server";
import { verifyRazorpaySignature } from "../../../../../lib/razorpay";
import { sendRegistrationEmail } from "../../../../../lib/email";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();
    if (!verifyRazorpaySignature(String(razorpay_order_id), String(razorpay_payment_id), String(razorpay_signature))) {
      return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
    }
    const transaction = await prisma.paymentTransaction.update({
      where: { orderId: String(razorpay_order_id) },
      data: { paymentId: String(razorpay_payment_id), signature: String(razorpay_signature), status: "Verified" },
      include: { registration: true }
    });
    const registration = await prisma.registration.update({
      where: { id: transaction.registrationId },
      data: { paymentStatus: "Verified", utr: String(razorpay_payment_id) }
    });
    void sendRegistrationEmail({
      to: registration.email,
      name: registration.name,
      publicId: registration.publicId,
      heading: "Online payment verified",
      action: "Your Razorpay payment has been verified successfully.",
      dashboardPath: `/dashboard?id=${encodeURIComponent(registration.publicId)}`,
      details: [["Payment ID", String(razorpay_payment_id)], ["Payment status", "Verified"]]
    });
    return NextResponse.json({ ok: true, publicId: registration.publicId });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Razorpay is not configured")) {
      return NextResponse.json({ error: "Razorpay is not configured." }, { status: 503 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not verify payment." }, { status: 500 });
  }
}

