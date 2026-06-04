import { createHmac } from "node:crypto";
import Razorpay from "razorpay";

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpayClient() {
  if (!razorpayConfigured()) {
    throw new Error("Razorpay is not configured.");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID as string,
    key_secret: process.env.RAZORPAY_KEY_SECRET as string
  });
}

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string) {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay is not configured.");
  }
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

