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
  const [message, setMessage] = useState(
    initialCheckedIn && initialCheckedInAt ? `Already checked in at ${formatDate(initialCheckedInAt)}.` : ""
  );
  const [messageType, setMessageType] = useState<"success" | "error" | "">(
    initialCheckedIn ? "success" : ""
  );

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
      setMessage("Enter the check-in passcode.");
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
        setMessage(payload.error || "Invalid check-in passcode.");
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
        <form className="checkin-passcode" onSubmit={unlockCheckIn}>
          <label>
            Limited check-in passcode
            <input value={passcode} onChange={(event) => setPasscode(event.target.value)} type="password" placeholder="Enter staff passcode" autoComplete="current-password" />
          </label>
          <button className="button secondary" type="submit" disabled={isUnlocking}>
            {isUnlocking ? "Unlocking..." : "Unlock Check-In"}
          </button>
        </form>
      ) : null}
      <button className="button primary" type="button" onClick={checkIn} disabled={isCheckedIn || isSaving}>
        {isSaving ? "Checking in..." : isCheckedIn ? "Already Checked In" : "Check In Delegate"}
      </button>
      {checkedInAt ? <small>Checked in: {formatDate(checkedInAt)}</small> : null}
      {message ? <p className={`form-message ${messageType}`} role="status">{message}</p> : null}
    </div>
  );
}
