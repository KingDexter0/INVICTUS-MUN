"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (!cleanEmail || !cleanPhone) {
      setMessage("Enter both your registered email and phone number.");
      setMessageType("error");
      return;
    }
    if (!cleanEmail.includes("@")) {
      setMessage("Enter a valid registered email address.");
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/delegate/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, phone: cleanPhone })
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error || "Could not verify those delegate details.");
        setMessageType("error");
        return;
      }

      setMessage("Delegate verified. Opening your dashboard...");
      setMessageType("success");
      router.push("/delegate/dashboard");
      router.refresh();
    } catch {
      setMessage("Could not reach the delegate login server. Please try again.");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="registration-form delegate-login-form" onSubmit={login}>
      <fieldset>
        <legend>Delegate verification</legend>
        <label>
          Registered email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="delegate@example.com" autoComplete="email" />
        </label>
        <label>
          Registered phone
          <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone used during registration" autoComplete="tel" />
        </label>
      </fieldset>
      <button className="button primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Verifying..." : "Open Delegate Dashboard"}
      </button>
      {message ? <p className={`form-message ${messageType}`} role="status">{message}</p> : null}
    </form>
  );
}

