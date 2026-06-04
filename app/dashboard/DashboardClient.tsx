"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isSafeExternalUrl } from "../../lib/security";

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

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function DashboardClient() {
  const searchParams = useSearchParams();
  const [lookup, setLookup] = useState(searchParams.get("id") || "");
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

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
    fetch("/api/resources")
      .then((response) => response.json())
      .then((payload) => setResources(payload.resources || []))
      .catch(() => setResources([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const hasAllotment = registration?.allotmentStatus === "Allotted";
  const canPayOnline = registration && registration.paymentStatus !== "Verified";
  const visibleResources = resources.filter((resource) => {
    if (resource.accessLevel === "Public" || resource.accessLevel === "Registered") return true;
    if (resource.accessLevel === "Approved") return registration?.registrationStatus === "Approved";
    if (resource.accessLevel === "Allotted") return hasAllotment;
    return true;
  });

  async function payOnline() {
    if (!registration) return;
    setIsPaying(true);
    setMessage("");
    setMessageType("");
    try {
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Could not load Razorpay checkout."));
          document.body.appendChild(script);
        });
      }
      const orderResponse = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: registration.publicId })
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok) {
        setMessage(order.error || "Could not create online payment order.");
        setMessageType("error");
        return;
      }
      const checkout = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount * 100,
        currency: order.currency,
        name: "Invictus MUN",
        description: `Registration ${registration.publicId}`,
        order_id: order.orderId,
        prefill: { name: registration.name, email: registration.email, contact: registration.phone },
        handler: async (payment: Record<string, string>) => {
          const verifyResponse = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payment)
          });
          const payload = await verifyResponse.json();
          if (!verifyResponse.ok) {
            setMessage(payload.error || "Payment could not be verified.");
            setMessageType("error");
            return;
          }
          setMessage("Payment verified successfully. Refreshing status...");
          setMessageType("success");
          await loadRegistration(registration.publicId);
        }
      });
      checkout.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open Razorpay checkout.");
      setMessageType("error");
    } finally {
      setIsPaying(false);
    }
  }

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
          {canPayOnline ? (
            <div className="empty-panel payment-action-panel">
              <h2>Online payment</h2>
              <p>Pay securely with Razorpay when the payment gateway is configured.</p>
              <button className="button primary" type="button" onClick={payOnline} disabled={isPaying}>{isPaying ? "Opening Razorpay..." : `Pay INR ${Number(registration.amount || 0).toLocaleString("en-IN")}`}</button>
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
                  <>
                    <Link className="qr-link" href={`/verify/pass/${registration.publicId}`}>
                      <img className="qr-code-image" src={`/api/qr/${registration.publicId}`} alt={`QR pass for ${registration.publicId}`} />
                      <strong>{registration.name}</strong>
                      <span>{registration.allottedCommittee} - {registration.allottedPortfolio}</span>
                      <small>/verify/pass/{registration.publicId}</small>
                    </Link>
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
            <article className="dashboard-card">
              <h2>Resources</h2>
              <div className="resource-list compact">
                {visibleResources.length ? visibleResources.map((resource) => (
                  isSafeExternalUrl(resource.fileUrl) ? (
                  <a key={resource.id} href={resource.fileUrl} target="_blank" rel="noopener noreferrer">
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
