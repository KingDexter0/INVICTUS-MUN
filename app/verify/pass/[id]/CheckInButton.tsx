"use client";

import { useState } from "react";

type CheckInButtonProps = {
  publicId: string;
  initialCheckedIn: boolean;
  initialCheckedInAt?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function CheckInButton({ publicId, initialCheckedIn, initialCheckedInAt }: CheckInButtonProps) {
  const [isCheckedIn, setIsCheckedIn] = useState(initialCheckedIn);
  const [checkedInAt, setCheckedInAt] = useState(initialCheckedInAt || "");
  const [isSaving, setIsSaving] = useState(false);
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [message, setMessage] = useState(
    initialCheckedIn && initialCheckedInAt ? `Already checked in at ${formatDate(initialCheckedInAt)}.` : ""
  );
  const [messageType, setMessageType] = useState<"success" | "error" | "">(
    initialCheckedIn ? "success" : ""
  );

  async function requestOtp() {
    setIsRequestingOtp(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch("/api/check-in/send-otp", {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not request OTP.");
        setMessageType("error");
        return;
      }
      setMessage("A 6-digit OTP has been sent to all admins. Check admin email to unlock.");
      setMessageType("success");
    } catch {
      setMessage("Could not connect to the OTP server.");
      setMessageType("error");
    } finally {
      setIsRequestingOtp(false);
    }
  }

  async function checkIn() {
    setIsSaving(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(`/api/verify/pass/${publicId}/check-in`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setNeedsPasscode(true);
        }
        setMessage(payload.error || "Could not check in delegate.");
        setMessageType("error");
        if (payload.registration?.checkedIn) {
          setIsCheckedIn(true);
          setCheckedInAt(payload.registration.checkedInAt || "");
        }
        return;
      }

      setIsCheckedIn(true);
      setCheckedInAt(payload.registration.checkedInAt);
      setMessage(`Checked in successfully at ${formatDate(payload.registration.checkedInAt)}.`);
      setMessageType("success");
    } catch {
      setMessage("Could not reach the check-in server. Please try again.");
      setMessageType("error");
    } finally {
      setIsSaving(false);
    }
  }

  async function unlockCheckIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passcode.trim()) {
      setMessage("Enter the check-in passcode or OTP.");
      setMessageType("error");
      return;
    }

    setIsUnlocking(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch("/api/check-in/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(payload.error || "Invalid check-in passcode or OTP.");
        setMessageType("error");
        return;
      }

      setNeedsPasscode(false);
      setPasscode("");
      setMessage("Check-in access unlocked. You can check in this delegate now.");
      setMessageType("success");
    } catch {
      setMessage("Could not reach the check-in session server. Please try again.");
      setMessageType("error");
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <div className="checkin-actions">
      {needsPasscode ? (
        <form className="checkin-passcode" onSubmit={unlockCheckIn} style={{ marginBottom: "15px" }}>
          <label>
            Limited check-in passcode or OTP
            <input value={passcode} onChange={(event) => setPasscode(event.target.value)} type="password" placeholder="Enter staff passcode or 6-digit OTP" autoComplete="off" />
          </label>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button className="button primary" type="submit" style={{ flex: 1, padding: "8px" }} disabled={isUnlocking}>
              {isUnlocking ? "Unlocking..." : "Unlock Check-In"}
            </button>
            <button className="button secondary" type="button" style={{ flex: 1, padding: "8px" }} onClick={requestOtp} disabled={isRequestingOtp}>
              {isRequestingOtp ? "Sending..." : "Request OTP"}
            </button>
          </div>
        </form>
      ) : null}
      <button className="button primary" type="button" onClick={checkIn} disabled={isCheckedIn || isSaving}>
        {isSaving ? "Checking in..." : isCheckedIn ? "Already Checked In" : "Check In Delegate"}
      </button>
      {checkedInAt ? <small style={{ display: "block", marginTop: "8px" }}>Checked in: {formatDate(checkedInAt)}</small> : null}
      {message ? <p className={`form-message ${messageType}`} role="status" style={{ marginTop: "10px" }}>{message}</p> : null}
    </div>
  );
}

