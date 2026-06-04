import { NextResponse } from "next/server";
import { razorpayClient } from "../../../../../lib/razorpay";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { publicId } = await request.json();
    const registration = await prisma.registration.findUnique({ where: { publicId: String(publicId || "").trim() } });
    if (!registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    const amount = Number(registration.amount || 0);
    if (amount <= 0) return NextResponse.json({ error: "Registration amount is invalid." }, { status: 400 });
    const order = await razorpayClient().orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: registration.publicId,
      notes: { registrationId: registration.publicId, delegate: registration.name }
    });
    await prisma.paymentTransaction.create({
      data: {
        registrationId: registration.id,
        orderId: order.id,
        amount,
        currency: order.currency || "INR",
        status: "Created"
      }
    });
    return NextResponse.json({ orderId: order.id, amount, currency: "INR", keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Razorpay is not configured")) {
      return NextResponse.json({ error: "Razorpay is not configured." }, { status: 503 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not create Razorpay order." }, { status: 500 });
  }
}

