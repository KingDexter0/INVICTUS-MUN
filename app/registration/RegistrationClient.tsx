"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { validatePaymentProofFile } from "../../lib/registrations";

export function RegistrationClient() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm(formData: FormData) {
    const errors: string[] = [];
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const payment = formData.get("payment");

    if (name.length < 2) errors.push("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter a valid email address.");
    if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) errors.push("Enter a valid phone number.");
    if (!String(formData.get("committee1") || "").trim()) errors.push("Choose your first committee preference.");

    const paymentError = validatePaymentProofFile(payment instanceof File ? payment : null);
    if (paymentError) errors.push(paymentError);

    return errors;
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const errors = validateForm(formData);

    if (errors.length) {
      setMessage(errors.join(" "));
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();

      if (!response.ok) {
        const detail = Array.isArray(payload.details) ? ` ${payload.details.join(" ")}` : "";
        setMessage(`${payload.error || "Registration could not be saved."}${detail}`);
        setMessageType("error");
        return;
      }

      setMessage("Registration saved successfully. Opening your dashboard...");
      setMessageType("success");
      router.push(`/dashboard?id=${encodeURIComponent(payload.id)}`);
    } catch {
      setMessage("Could not reach the registration server. Please check your connection and try again.");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="registration-form" id="registrationForm" onSubmit={submitRegistration}>
        <fieldset>
          <legend>Personal Details</legend>
          <label>Full name<input required name="name" minLength={2} autoComplete="name" placeholder="Your full name" /></label>
          <label>Email<input required type="email" name="email" autoComplete="email" placeholder="you@example.com" /></label>
          <label>Phone<input required name="phone" minLength={7} maxLength={20} inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" /></label>
          <label>Institution<input name="institution" placeholder="School / college name" /></label>
        </fieldset>
        <fieldset>
          <legend>Registration Details</legend>
          <label>Registration type<select name="type"><option>Individual Delegate</option><option>Delegation Delegate</option><option>International Delegate</option><option>International Press</option><option>Executive Board</option><option>Secretariat</option></select></label>
          <label>Committee preference 1<select name="committee1"><option>UNHRC</option><option>Arab League</option><option>UNCSW</option><option>FIFA</option><option>UNGA Emergency Special Session</option><option>Lok Sabha</option><option>International Press</option></select></label>
          <label>Portfolio preference 1<input name="portfolio1" placeholder="Country / role preference" /></label>
          <label>Committee preference 2<select name="committee2"><option>Arab League</option><option>UNHRC</option><option>UNCSW</option><option>FIFA</option><option>Lok Sabha</option><option>International Press</option></select></label>
        </fieldset>
        <fieldset>
          <legend>Experience and Payment</legend>
          <label>MUNs attended<input type="number" min="0" name="muns" placeholder="0" /></label>
          <label>Awards won<input type="number" min="0" name="awards" placeholder="0" /></label>
          <label>Transaction ID / UTR<input name="utr" placeholder="UPI or bank transaction ID" /></label>
          <label>Payment proof<input type="file" name="payment" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" /></label>
          <label className="wide">Experience description<textarea rows={4} name="experience" placeholder="Tell us about prior debate, EB, press, or leadership experience."></textarea></label>
        </fieldset>
        <fieldset>
          <legend>Accommodation</legend>
          <label>Accommodation required?<select name="accommodation"><option>No</option><option>Yes</option></select></label>
          <label>Transport required?<select name="transport"><option>No</option><option>Yes</option></select></label>
          <label>Arrival city<input name="arrivalCity" placeholder="Delhi, Mumbai, Dubai..." /></label>
          <label>Special requirements<input name="requirements" placeholder="Food, medical, access needs..." /></label>
        </fieldset>
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Registration"}
        </button>
        {message ? <p className={`form-message ${messageType}`} role="status">{message}</p> : null}
      </form>
    </>
  );
}
