"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Announcement = {
  id: string;
  title: string;
  audience: string;
  message: string;
  createdAt: string;
};

type Registration = {
  publicId: string;
  name: string;
  email: string;
  phone: string;
  institution?: string | null;
  type: string;
  committee1: string;
  committee2?: string | null;
  portfolio1?: string | null;
  utr?: string | null;
  paymentStatus: string;
  registrationStatus: string;
  allotmentStatus: string;
  allottedCommittee?: string | null;
  allottedPortfolio?: string | null;
};

export function DashboardClient() {
  const searchParams = useSearchParams();
  const [lookup, setLookup] = useState(searchParams.get("id") || "");
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  async function loadRegistration(query = lookup) {
    const trimmed = query.trim();
    if (!trimmed) {
      setMessage("Enter your registration ID, email, or phone number to check status.");
      setMessageType("error");
      setRegistration(null);
      return;
    }

    const key = trimmed.includes("@") ? "email" : trimmed.toUpperCase().startsWith("INV-") ? "id" : "phone";
    setIsLookingUp(true);

    try {
      const response = await fetch(`/api/registrations/status?${key}=${encodeURIComponent(trimmed)}`);
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error || "No registration matched that lookup. Check the spelling or try another detail.");
        setMessageType("error");
        setRegistration(null);
        return;
      }

      setMessage("Registration found.");
      setMessageType("success");
      setRegistration(payload.registration);
    } catch {
      setMessage("Could not reach the status server. Please try again.");
      setMessageType("error");
      setRegistration(null);
    } finally {
      setIsLookingUp(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get("id");
    if (initial) {
      setLookup(initial);
      void loadRegistration(initial);
    }
    fetch("/api/announcements")
      .then((response) => response.json())
      .then((payload) => setAnnouncements(payload.announcements || []))
      .catch(() => setAnnouncements([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const hasAllotment = registration?.allotmentStatus === "Allotted";

  return (
    <section className="section delegate-dashboard">
      <form
        className="lookup-form"
        onSubmit={(event) => {
          event.preventDefault();
          void loadRegistration();
        }}
      >
        <input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="Enter registration ID, email, or phone" />
        <button className="button primary" type="submit" disabled={isLookingUp}>{isLookingUp ? "Checking..." : "Check Status"}</button>
      </form>
      {message ? <p className={`form-message ${messageType}`} role="status">{message}</p> : null}

      {registration ? (
        <>
          <div className="delegate-status-grid">
            <article><span>Registration</span><strong>{registration.registrationStatus}</strong></article>
            <article><span>Payment</span><strong>{registration.paymentStatus}</strong></article>
            <article><span>Allotment</span><strong>{registration.allotmentStatus}</strong></article>
            <article><span>QR Pass</span><strong>{hasAllotment ? "Ready" : "Locked"}</strong></article>
          </div>
          <div className="dashboard-detail-grid">
            <article className="dashboard-card">
              <h2>Registration Details</h2>
              <dl>
                {[
                  ["Delegate ID", registration.publicId],
                  ["Name", registration.name],
                  ["Email", registration.email],
                  ["Phone", registration.phone],
                  ["Institution", registration.institution || "Independent delegate"],
                  ["Registration type", registration.type],
                  ["Preference 1", registration.committee1],
                  ["Preference 2", registration.committee2 || "-"],
                  ["Transaction ID", registration.utr || "Not submitted"]
                ].map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            </article>
            <article className="dashboard-card">
              <h2>Final Allotment</h2>
              <div className="allotment-card">
                {hasAllotment ? (
                  <><strong>{registration.allottedCommittee}</strong><span>{registration.allottedPortfolio}</span><small>Released after admin approval.</small></>
                ) : (
                  <><strong>Not released yet</strong><span>Your allotment appears here after approval.</span></>
                )}
              </div>
            </article>
            <article className="dashboard-card">
              <h2>QR Pass</h2>
              <div className="qr-pass">
                {hasAllotment ? (
                  <><div className="qr-box">{registration.publicId.slice(-3)}</div><strong>{registration.name}</strong><span>{registration.allottedCommittee} - {registration.allottedPortfolio}</span><small>/verify/pass/{registration.publicId}</small></>
                ) : (
                  <><div className="qr-box locked">--</div><strong>QR pass locked</strong><span>Approval and allotment required.</span></>
                )}
              </div>
            </article>
            <article className="dashboard-card">
              <h2>Announcements</h2>
              <div className="resource-list compact">
                {announcements.length ? announcements.map((announcement) => (
                  <a key={announcement.id} href="#"><strong>{announcement.title}</strong><span>{announcement.audience}</span></a>
                )) : <p className="empty-copy">No announcements have been published yet.</p>}
              </div>
            </article>
            <article className="dashboard-card">
              <h2>Resources</h2>
              <p className="empty-copy">Delegate-only resources will appear here after the organizing team releases them.</p>
            </article>
          </div>
        </>
      ) : (
        <div className="empty-panel">
          <h2>Check your registration status</h2>
          <p>Use your Invictus registration ID, email address, or phone number to view payment status, approval, allotment, and QR pass availability.</p>
        </div>
      )}
    </section>
  );
}
