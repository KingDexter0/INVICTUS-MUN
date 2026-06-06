"use client";

import { useEffect, useState } from "react";

type CheckInButtonProps = {
  publicId: string;
  initialCheckedIn: boolean;
  initialCheckedInAt?: string | null;
  delegateName: string;
  delegateCommittee: string;
  delegateInstitution: string;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function CheckInButton({
  publicId,
  initialCheckedIn,
  initialCheckedInAt,
  delegateName,
  delegateCommittee,
  delegateInstitution
}: CheckInButtonProps) {
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

  // New OTP Modal states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [delegateOtp, setDelegateOtp] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Request staff session passcode/OTP (if 401 occurs)
  async function requestStaffOtp() {
    setIsSaving(true);
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
      setIsSaving(false);
    }
  }

  // Handle staff session passcode unlock
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

  // Initiate Delegate Check-In (Triggers Delegate OTP sending)
  async function startDelegateCheckIn() {
    setRequestingOtp(true);
    setModalError("");
    setModalSuccess("");
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(`/api/verify/pass/${publicId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setNeedsPasscode(true);
          setMessage("Check-in session is locked. Please unlock the check-in session first.");
          setMessageType("error");
        } else {
          setMessage(payload.error || "Could not check in delegate.");
          setMessageType("error");
        }
        return;
      }

      // If OTP was sent successfully
      if (payload.status === "OTP_SENT") {
        setShowOtpModal(true);
        setModalSuccess("OTP has been sent to all admins.");
        setResendCooldown(30); // 30s cooldown
      } else if (payload.status === "CHECKED_IN" || payload.status === "ALREADY_CHECKED_IN") {
        setIsCheckedIn(true);
        setCheckedInAt(payload.checkedInAt || payload.registration?.checkedInAt || "");
        setMessage(payload.message || "Delegate checked in.");
        setMessageType("success");
      }
    } catch (error) {
      setMessage("Could not initiate check-in. Check your connection.");
      setMessageType("error");
    } finally {
      setRequestingOtp(false);
    }
  }

  // Resend Delegate Check-In OTP
  async function resendDelegateOtp() {
    if (resendCooldown > 0) return;
    setResendCooldown(30);
    setModalError("");
    setModalSuccess("");

    try {
      const response = await fetch(`/api/verify/pass/${publicId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const payload = await response.json();

      if (!response.ok) {
        setModalError(payload.error || "Could not resend OTP.");
        setResendCooldown(0); // Clear cooldown on error so they can try again
      } else {
        setModalSuccess("A new OTP has been sent to all admins.");
      }
    } catch {
      setModalError("Could not connect to the server.");
      setResendCooldown(0);
    }
  }

  // Verify Delegate Check-In OTP
  async function verifyDelegateOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (delegateOtp.length !== 6 || isNaN(Number(delegateOtp))) {
      setModalError("Please enter a valid 6-digit OTP.");
      return;
    }

    setVerifyingOtp(true);
    setModalError("");
    setModalSuccess("");

    try {
      const response = await fetch(`/api/verify/pass/${publicId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: delegateOtp })
      });
      const payload = await response.json();

      if (!response.ok) {
        setModalError(payload.error || "Invalid OTP. Please try again.");
      } else {
        setIsCheckedIn(true);
        setCheckedInAt(payload.checkedInAt || "");
        setMessage(`Delegate checked in successfully at ${formatDate(payload.checkedInAt)}.`);
        setMessageType("success");
        setShowOtpModal(false);
        setDelegateOtp("");
      }
    } catch {
      setModalError("Could not verify OTP. Please try again.");
    } finally {
      setVerifyingOtp(false);
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
            <button className="button secondary" type="button" style={{ flex: 1, padding: "8px" }} onClick={requestStaffOtp} disabled={isSaving}>
              {isSaving ? "Sending..." : "Request OTP"}
            </button>
          </div>
        </form>
      ) : null}

      <button
        className="button primary"
        type="button"
        onClick={startDelegateCheckIn}
        disabled={isCheckedIn || requestingOtp}
      >
        {requestingOtp ? "Sending OTP..." : isCheckedIn ? "Already Checked In" : "Check In Delegate"}
      </button>

      {checkedInAt ? <small style={{ display: "block", marginTop: "8px" }}>Checked in: {formatDate(checkedInAt)}</small> : null}
      {message ? <p className={`form-message ${messageType}`} role="status" style={{ marginTop: "10px" }}>{message}</p> : null}

      {/* Delegate OTP Modal */}
      {showOtpModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(9, 6, 18, 0.65)",
          backdropFilter: "blur(8px)",
          display: "grid",
          placeItems: "center",
          zIndex: 999,
          padding: "20px"
        }}>
          <div className="verify-card" style={{
            maxWidth: "500px",
            width: "100%",
            background: "#fff",
            borderRadius: "24px",
            border: "1px solid rgba(109,67,200,0.15)",
            padding: "30px",
            boxShadow: "0 20px 60px rgba(51, 36, 88, 0.15)",
            textAlign: "center"
          }}>
            <p className="eyebrow" style={{ color: "var(--purple)", fontWeight: "800", marginBottom: "8px" }}>
              CHECK-IN OTP VERIFICATION
            </p>
            <h3 style={{ fontSize: "1.6em", fontWeight: "900", marginBottom: "15px" }}>
              Enter verification code
            </h3>
            <p style={{ fontSize: "0.95em", color: "var(--muted)", marginBottom: "20px" }}>
              OTP has been sent to all admins.
            </p>

            {/* Delegate Details */}
            <div style={{
              background: "#f7f4fb",
              borderRadius: "16px",
              padding: "15px",
              textAlign: "left",
              fontSize: "0.9em",
              marginBottom: "20px"
            }}>
              <div style={{ marginBottom: "5px" }}><strong>Delegate:</strong> {delegateName}</div>
              <div style={{ marginBottom: "5px" }}><strong>ID:</strong> {publicId}</div>
              <div style={{ marginBottom: "5px" }}><strong>Committee:</strong> {delegateCommittee}</div>
              <div><strong>Institution:</strong> {delegateInstitution}</div>
            </div>

            <form onSubmit={verifyDelegateOtp} style={{ display: "grid", gap: "15px" }}>
              <input
                type="text"
                value={delegateOtp}
                onChange={(e) => setDelegateOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                style={{
                  fontSize: "1.6em",
                  textAlign: "center",
                  letterSpacing: "8px",
                  fontWeight: "bold",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid var(--line)"
                }}
                required
              />

              {modalError && <p className="form-message error" style={{ margin: "5px 0" }}>{modalError}</p>}
              {modalSuccess && <p className="form-message success" style={{ margin: "5px 0" }}>{modalSuccess}</p>}

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="submit"
                  className="button primary"
                  style={{ flex: 1 }}
                  disabled={verifyingOtp}
                >
                  {verifyingOtp ? "Verifying..." : "Verify OTP"}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={resendDelegateOtp}
                  disabled={resendCooldown > 0}
                  style={{ flex: 1 }}
                >
                  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend OTP"}
                </button>
              </div>
              <button
                type="button"
                className="button ghost"
                onClick={() => {
                  setShowOtpModal(false);
                  setDelegateOtp("");
                  setModalError("");
                  setModalSuccess("");
                }}
                style={{ marginTop: "5px" }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
