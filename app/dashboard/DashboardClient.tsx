"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isSafeExternalUrl } from "../../lib/security";
import { DynamicUpiQr } from "../components/DynamicUpiQr";

type Announcement = {
  id: string;
  title: string;
  audience: string;
  message: string;
  createdAt: string;
};

type Resource = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  accessLevel: string;
  fileUrl: string;
  createdAt: string;
};

type Registration = {
  publicId: string;
  trackingToken?: string | null;
  name: string;
  email: string;
  phone: string;
  institution?: string | null;
  type: string;
  committee1: string;
  committee2?: string | null;
  portfolio1?: string | null;
  utr?: string | null;
  amount: number;
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
  const [resources, setResources] = useState<Resource[]>([]);
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

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    const key = trimmed.includes("@") ? "email" : (trimmed.toUpperCase().startsWith("INV-") || isUuid) ? "id" : "phone";
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
    fetch("/api/resources")
      .then((response) => response.json())
      .then((payload) => setResources(payload.resources || []))
      .catch(() => setResources([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const isDelegation = registration?.type === "delegation";
  const hasAllotment = registration?.allotmentStatus === "Allotted" ||
    (isDelegation && registration?.registrationStatus === "Approved");
  const canPayOnline = registration && registration.paymentStatus !== "Verified";
  const timelineSteps = registration ? [
    { label: "Registered", active: Boolean(registration.publicId), detail: registration.publicId },
    { label: "Payment", active: registration.paymentStatus === "Verified", detail: registration.paymentStatus },
    { label: "Approved", active: registration.registrationStatus === "Approved", detail: registration.registrationStatus },
    { label: isDelegation ? "Group Ready" : "Allotted", active: hasAllotment, detail: isDelegation ? (registration.registrationStatus === "Approved" ? "Approved" : "Pending") : registration.allotmentStatus },
    { label: "QR Ready", active: hasAllotment, detail: hasAllotment ? "Ready" : "Locked" }
  ] : [];
  const visibleResources = resources.filter((resource) => {
    if (resource.accessLevel === "Public" || resource.accessLevel === "Registered") return true;
    if (resource.accessLevel === "Approved") return registration?.registrationStatus === "Approved";
    if (resource.accessLevel === "Allotted") return hasAllotment;
    return true;
  });

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
          <div className="status-timeline" aria-label="Registration progress timeline">
            {timelineSteps.map((step, index) => (
              <article className={step.active ? "status-step active" : "status-step"} key={step.label}>
                <span className="status-dot">{index + 1}</span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </article>
            ))}
          </div>
          <div className="delegate-status-grid">
            <article><span>Registration</span><strong>{registration.registrationStatus}</strong></article>
            <article><span>Payment</span><strong>{registration.paymentStatus}</strong></article>
            <article><span>Allotment</span><strong>{registration.allotmentStatus}</strong></article>
            <article><span>QR Pass</span><strong>{hasAllotment ? "Ready" : "Locked"}</strong></article>
          </div>
          {canPayOnline ? (
            <div className="empty-panel payment-action-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <h2>UPI Payment QR</h2>
              <p style={{ maxWidth: "500px", marginBottom: "15px" }}>If your payment verification is pending or rejected, please scan the QR code below to transfer.</p>
              <DynamicUpiQr amount={registration.amount} />
              <p style={{ fontSize: "0.9em", color: "var(--text-muted)", maxWidth: "500px", marginTop: "15px" }}>After making the payment, please send the screenshot of the successful transaction showing the UTR/transaction ID to the organizing committee for manual verification.</p>
            </div>
          ) : null}
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
                  ["Payment ID", registration.utr || "Not paid through Razorpay yet"]
                ].map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            </article>
            <article className="dashboard-card">
              <h2>Final Allotment</h2>
              <div className="allotment-card">
                {isDelegation ? (
                  registration.registrationStatus === "Approved" ? (
                    <><strong>Delegation Approved</strong><span>Check your registered emails for individual committee assignments.</span></>
                  ) : (
                    <><strong>Pending Approval</strong><span>Allotments will be released once delegation is approved.</span></>
                  )
                ) : hasAllotment ? (
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
                  <>
                    <div className="qr-link">
                      <img className="qr-code-image" src={`/api/qr/${registration.trackingToken || registration.publicId}`} alt={`QR pass for ${registration.publicId}`} />
                      <strong>{registration.name}</strong>
                      <span>{isDelegation ? "Delegation Group Pass" : `${registration.allottedCommittee} - ${registration.allottedPortfolio}`}</span>
                      <small style={{ color: "var(--muted)" }}>/verify/pass/{registration.trackingToken || registration.publicId}</small>
                    </div>
                  </>
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
            <article className="dashboard-card" id="resources">
              <h2>Resources</h2>
              <div className="resource-list compact">
                {visibleResources.length ? visibleResources.map((resource) => (
                  isSafeExternalUrl(resource.fileUrl) ? (
                  <a key={resource.id} href={`/api/resources/${resource.id}/download`} download>
                    <strong>{resource.title}</strong>
                    <span>{resource.category} - {resource.accessLevel}</span>
                  </a>
                  ) : null
                )) : <p className="empty-copy">No resources have been released for your current status yet.</p>}
              </div>
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
