"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/eb/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not verify EB access.");
        return;
      }
      router.push("/eb/dashboard");
      router.refresh();
    } catch {
      setMessage("Could not reach the EB login server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="registration-form delegate-login-form" onSubmit={submit}>
      <fieldset>
        <legend>EB Verification</legend>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Phone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
      </fieldset>
      <button className="button primary" disabled={isSubmitting}>{isSubmitting ? "Verifying..." : "Open EB Dashboard"}</button>
      {message ? <p className="form-message error">{message}</p> : null}
    </form>
  );
}

