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

  return (
    <div className="checkin-actions">
      <button className="button primary" type="button" onClick={checkIn} disabled={isCheckedIn || isSaving}>
        {isSaving ? "Checking in..." : isCheckedIn ? "Already Checked In" : "Check In Delegate"}
      </button>
      {checkedInAt ? <small>Checked in: {formatDate(checkedInAt)}</small> : null}
      {message ? <p className={`form-message ${messageType}`} role="status">{message}</p> : null}
    </div>
  );
}
