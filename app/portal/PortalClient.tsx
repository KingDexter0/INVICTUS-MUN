"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Note = {
  id: string;
  note: string;
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
  portfolio1?: string | null;
  utr?: string | null;
  amount: number;
  paymentProofUrl?: string | null;
  paymentStatus: string;
  registrationStatus: string;
  allotmentStatus: string;
  allottedCommittee?: string | null;
  allottedPortfolio?: string | null;
  notes?: Note[];
};

type Resource = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  accessLevel: string;
  fileUrl: string;
  filePublicId: string;
  createdAt: string;
  updatedAt: string;
};

const capacities: Record<string, number> = {
  UNHRC: 70,
  "Arab League": 65,
  UNCSW: 55,
  FIFA: 60,
  "UNGA Emergency Special Session": 75,
  "Lok Sabha": 70,
  "International Press": 40
};

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("verified") || normalized.includes("approved")) return "verified";
  if (normalized.includes("reject")) return "rejected";
  if (normalized.includes("allotted")) return "allotted";
  if (normalized.includes("review")) return "review";
  return "pending";
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function needsReview(registration: Registration) {
  return registration.paymentStatus !== "Verified" || registration.registrationStatus !== "Approved" || registration.allotmentStatus !== "Allotted";
}

function filterLabel(filter: string) {
  const labels: Record<string, string> = {
    all: "All registrations",
    pending: "Needs review",
    payments: "Payment review",
    approved: "Approved",
    allotments: "Awaiting allotment",
    allotted: "Allotted / QR ready"
  };
  return labels[filter] || filter;
}

function actionSuccessMessage(label: string, name: string, emailStatus?: string) {
  const labels: Record<string, string> = {
    "Payment rejection": "Payment rejected",
    "Payment verification": "Payment verified",
    "Registration approval": "Registration approved",
    "Allotment release": "Allotment released"
  };
  const action = labels[label] || label;
  if (emailStatus === "sent") return `${action} for ${name}, and email sent.`;
  if (emailStatus === "failed") return `${action} for ${name}, but email failed.`;
  if (emailStatus === "skipped") return `${action} for ${name}. Email skipped because Resend is not configured.`;
  return `${action} saved for ${name}.`;
}

export function PortalClient() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCommittee, setSelectedCommittee] = useState("");
  const [active, setActive] = useState<Registration | null>(null);
  const [committee, setCommittee] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploadingResource, setIsUploadingResource] = useState(false);
  const [deletingResourceId, setDeletingResourceId] = useState("");
  const [announcement, setAnnouncement] = useState({ title: "", audience: "All registered delegates", message: "" });

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passcode.trim()) {
      setMessage("Enter the admin passcode.");
      setMessageType("error");
      return;
    }
    setIsUnlocking(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Invalid admin passcode.");
        setMessageType("error");
        return;
      }
      setIsUnlocked(true);
      setMessage("Portal unlocked.");
      setMessageType("success");
      await loadRegistrations();
      await loadResources();
    } catch {
      setMessage("Could not reach the admin session server.");
      setMessageType("error");
    } finally {
      setIsUnlocking(false);
    }
  }

  async function loadResources() {
    try {
      const response = await fetch("/api/resources");
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not load resources.");
        setMessageType("error");
        return;
      }
      setResources(payload.resources || []);
    } catch {
      setMessage("Could not load resources.");
      setMessageType("error");
    }
  }

  async function loadRegistrations() {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    try {
      const response = await fetch(`/api/registrations?${params.toString()}`);
      if (response.status === 401) {
        setIsUnlocked(false);
        setMessage("Admin session expired. Unlock the portal again.");
        setMessageType("error");
        return;
      }
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not load registrations.");
        setMessageType("error");
        return;
      }
      setRegistrations(payload.registrations || []);
    } catch {
      setMessage("Could not load registrations. Check the database connection and try again.");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isUnlocked) {
      void loadRegistrations();
      void loadResources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, isUnlocked]);

  const stats = useMemo(() => {
    const verified = registrations.filter((item) => item.paymentStatus === "Verified");
    const approved = registrations.filter((item) => item.registrationStatus === "Approved");
    const allotted = registrations.filter((item) => item.allotmentStatus === "Allotted");
    const needsPayment = registrations.filter((item) => item.paymentStatus !== "Verified").length;
    const needsAllotment = registrations.filter((item) => item.registrationStatus === "Approved" && item.allotmentStatus !== "Allotted").length;
    return {
      verified,
      approved,
      allotted,
      needsPayment,
      needsAllotment,
      revenue: verified.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    };
  }, [registrations]);

  const visible = registrations.filter((registration) => {
    const filterMatch =
      activeFilter === "all" ||
      (activeFilter === "pending" && needsReview(registration)) ||
      (activeFilter === "payments" && registration.paymentStatus !== "Verified") ||
      (activeFilter === "approved" && registration.registrationStatus === "Approved") ||
      (activeFilter === "allotments" && registration.registrationStatus === "Approved" && registration.allotmentStatus !== "Allotted") ||
      (activeFilter === "allotted" && registration.allotmentStatus === "Allotted");
    const committeeMatch =
      !selectedCommittee ||
      registration.committee1 === selectedCommittee ||
      registration.allottedCommittee === selectedCommittee;
    return filterMatch && committeeMatch;
  });

  function jumpToRegistrations(filter: string, committeeName = "") {
    setActiveFilter(filter);
    setSelectedCommittee(committeeName);
    setTimeout(() => document.querySelector("#registrations")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function clearView() {
    setActiveFilter("all");
    setSelectedCommittee("");
    setSearch("");
  }

  function openRegistration(registration: Registration) {
    setActive(registration);
    setCommittee(registration.allottedCommittee || "");
    setPortfolio(registration.allottedPortfolio || registration.portfolio1 || "");
    setNote("");
  }

  async function patchActive(label: string, patch: Record<string, string | null>) {
    if (!active) return;
    setActiveAction(label);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch(`/api/registrations/${active.publicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, note: note.trim() || undefined })
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not update registration.");
        setMessageType("error");
        return;
      }
      setMessage(actionSuccessMessage(label, active.name, payload.emailStatus));
      setMessageType("success");
      setActive(null);
      await loadRegistrations();
    } catch {
      setMessage("Could not save the admin action. Please try again.");
      setMessageType("error");
    } finally {
      setActiveAction("");
    }
  }

  async function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (announcement.title.trim().length < 3 || announcement.message.trim().length < 5) {
      setMessage("Add a clear announcement title and message before publishing.");
      setMessageType("error");
      return;
    }
    setIsPublishing(true);
    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(announcement)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not publish announcement.");
        setMessageType("error");
        return;
      }
      setAnnouncement({ title: "", audience: "All registered delegates", message: "" });
      setMessage("Announcement published.");
      setMessageType("success");
    } catch {
      setMessage("Could not reach the announcement server.");
      setMessageType("error");
    } finally {
      setIsPublishing(false);
    }
  }

  async function uploadResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const file = formData.get("file");

    if (title.length < 3) {
      setMessage("Resource title must be at least 3 characters.");
      setMessageType("error");
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setMessage("Upload a file before saving the resource.");
      setMessageType("error");
      return;
    }

    setIsUploadingResource(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch("/api/resources", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not upload resource.");
        setMessageType("error");
        return;
      }
      form.reset();
      setMessage("Resource uploaded.");
      setMessageType("success");
      await loadResources();
    } catch {
      setMessage("Could not reach the resource upload server.");
      setMessageType("error");
    } finally {
      setIsUploadingResource(false);
    }
  }

  async function deleteResource(resource: Resource) {
    setDeletingResourceId(resource.id);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(`/api/resources/${resource.id}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not delete resource.");
        setMessageType("error");
        return;
      }
      setMessage(`Deleted resource: ${resource.title}.`);
      setMessageType("success");
      await loadResources();
    } catch {
      setMessage("Could not reach the resource delete server.");
      setMessageType("error");
    } finally {
      setDeletingResourceId("");
    }
  }

  if (!isUnlocked) {
    return (
      <main className="portal-unlock">
        <form className="registration-aside unlock-card" onSubmit={unlock}>
          <h2>Admin Access</h2>
          <p>Enter the admin passcode from `ADMIN_PASSCODE` to open the organizer portal.</p>
          <input value={passcode} onChange={(event) => setPasscode(event.target.value)} type="password" placeholder="Admin passcode" autoComplete="current-password" />
          <button className="button primary" type="submit" disabled={isUnlocking}>{isUnlocking ? "Unlocking..." : "Unlock Portal"}</button>
          {message ? <p className={`form-message ${messageType}`} role="status">{message}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <>
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-mark logo-mark"><img src="/invictus-logo.jpg" alt="" /></span><span><strong>INVICTUS</strong><small>MODEL UNITED NATIONS</small></span></Link>
        <nav className="primary-nav" aria-label="Main navigation">
          <p className="nav-label">COMMAND CENTRE</p>
          <Link className="nav-item" href="/"><span className="nav-icon">H</span> Public Site</Link>
          <button className="nav-item active" type="button" onClick={() => clearView()}><span className="nav-icon">O</span> Overview</button>
          <button className="nav-item" type="button" onClick={() => jumpToRegistrations("all")}><span className="nav-icon">R</span> Registrations <b>{registrations.length}</b></button>
          <button className="nav-item" type="button" onClick={() => jumpToRegistrations("payments")}><span className="nav-icon">P</span> Payments <b>{stats.needsPayment}</b></button>
          <button className="nav-item" type="button" onClick={() => jumpToRegistrations("allotments")}><span className="nav-icon">A</span> Allotments <b>{stats.needsAllotment}</b></button>
          <button className="nav-item" type="button" onClick={() => document.querySelector("#resources")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span className="nav-icon">D</span> Resources <b>{resources.length}</b></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="admin-card"><div className="avatar">YP</div><span><strong>Yoksh Patil</strong><small>Super Admin</small></span></div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu">Menu</button>
          <div className="search-box"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search delegates, committees, transactions..." /><kbd>Ctrl K</kbd></div>
          <div className="top-actions"><div className="event-switcher"><span className="event-dot"></span><span><small>ACTIVE EVENT</small><strong>Invictus MUN 2026</strong></span></div></div>
        </header>

        <section className="content" id="overview">
          <div className="page-heading">
            <div><p className="eyebrow">ADMIN PORTAL</p><h1>Good evening, Yoksh.</h1><p>Here is the live conference workspace.</p></div>
            <div className="heading-actions"><button className="button secondary" type="button" onClick={clearView}>Clear view</button><a className="button secondary" href="/api/export/registrations.csv">Export CSV</a></div>
          </div>
          {message ? <p className={`form-message ${messageType}`} role="status">{message}</p> : null}

          <div className="stats-grid">
            <button className="stat-card clickable-card" type="button" onClick={() => jumpToRegistrations("all")}><div className="stat-head"><span className="stat-icon lavender">R</span><span className="trend up">Live</span></div><p>Total registrations</p><h3>{registrations.length}</h3><small>Click to view all</small></button>
            <button className="stat-card clickable-card" type="button" onClick={() => jumpToRegistrations("payments")}><div className="stat-head"><span className="stat-icon amber">P</span><span className="trend">{stats.needsPayment} pending</span></div><p>Revenue collected</p><h3>INR {stats.revenue.toLocaleString("en-IN")}</h3><small>Click to review payments</small></button>
            <button className="stat-card clickable-card" type="button" onClick={() => jumpToRegistrations("approved")}><div className="stat-head"><span className="stat-icon green">A</span><span className="trend up">Approved</span></div><p>Approved delegates</p><h3>{stats.approved.length}</h3><small>Click to view approved</small></button>
            <button className="stat-card clickable-card" type="button" onClick={() => jumpToRegistrations("allotted")}><div className="stat-head"><span className="stat-icon blue">Q</span><span className="trend">QR</span></div><p>Allotments released</p><h3>{stats.allotted.length}</h3><small>Click to view QR-ready</small></button>
          </div>

          <div className="dashboard-grid">
            <section className="panel registrations-panel" id="registrations">
              <div className="panel-head"><div><p className="eyebrow">OPERATIONS</p><h2>Registrations</h2><small className="view-chip">{filterLabel(activeFilter)}{selectedCommittee ? ` - ${selectedCommittee}` : ""}</small></div><Link href="/registration">Add delegate</Link></div>
              <div className="table-tools">
                <div className="tabs" role="tablist">
                  {[
                    ["all", registrations.length],
                    ["pending", registrations.filter(needsReview).length],
                    ["payments", stats.needsPayment],
                    ["approved", stats.approved.length],
                    ["allotments", stats.needsAllotment],
                    ["allotted", stats.allotted.length]
                  ].map(([filter, count]) => (
                    <button className={`tab ${activeFilter === filter ? "active" : ""}`} data-filter={filter} onClick={() => setActiveFilter(String(filter))} key={filter}>{String(filter)[0].toUpperCase() + String(filter).slice(1)} <span>{count}</span></button>
                  ))}
                </div>
                {(selectedCommittee || search || activeFilter !== "all") ? <button className="filter-button" type="button" onClick={clearView}>Clear filters</button> : null}
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Delegate</th><th>Type</th><th>Preference</th><th>Payment</th><th>Status</th><th>Allotment</th><th></th></tr></thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={7}><div className="empty-state">Loading registrations...</div></td></tr>
                    ) : visible.length ? visible.map((registration, index) => (
                      <tr key={registration.publicId}>
                        <td><div className="delegate"><span className={`avatar ${["purple", "pink", "blue", "gold"][index % 4]}`}>{initials(registration.name)}</span><span><strong>{registration.name}</strong><small>{registration.institution || registration.email}</small></span></div></td>
                        <td>{registration.type}</td>
                        <td>{registration.committee1}</td>
                        <td><span className={`status ${statusClass(registration.paymentStatus)}`}>{registration.paymentStatus}</span></td>
                        <td><span className={`status ${statusClass(registration.registrationStatus)}`}>{registration.registrationStatus}</span></td>
                        <td><span className={`status ${statusClass(registration.allotmentStatus)}`}>{registration.allotmentStatus}</span></td>
                        <td><button className="row-action" onClick={() => openRegistration(registration)}>Review</button></td>
                      </tr>
                    )) : <tr><td colSpan={7}><div className="empty-state">{registrations.length ? "No registrations match this view. Clear filters or search again." : "No registrations yet. New delegate submissions will appear here."}</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="panel attention-panel">
              <div className="panel-head"><div><p className="eyebrow">PRIORITY QUEUE</p><h2>Needs attention</h2></div><span className="count-badge">{stats.needsPayment + stats.needsAllotment}</span></div>
              <div className="attention-list">
                <button className="attention-item" onClick={() => jumpToRegistrations("payments")}><span className="attention-icon urgent">!</span><span><strong>{stats.needsPayment} payments need verification</strong><small>Review screenshots and UTRs</small></span><b>Open</b></button>
                <button className="attention-item" onClick={() => jumpToRegistrations("allotments")}><span className="attention-icon">A</span><span><strong>{stats.needsAllotment} delegates await allotment</strong><small>Approved but not released</small></span><b>Open</b></button>
              </div>
              <form className="announcement-mini" onSubmit={publishAnnouncement}>
                <h3>Publish announcement</h3>
                <input value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} placeholder="Title" required />
                <textarea value={announcement.message} onChange={(event) => setAnnouncement({ ...announcement, message: event.target.value })} placeholder="Message" required />
                <button className="button secondary full" type="submit" disabled={isPublishing}>{isPublishing ? "Publishing..." : "Publish"}</button>
                <p className="empty-copy">Announcements saved here appear on delegate dashboards.</p>
              </form>
            </aside>
          </div>

          <div className="lower-grid">
            <section className="panel committees-panel" id="allotments">
              <div className="panel-head"><div><p className="eyebrow">CAPACITY TRACKER</p><h2>Committee health</h2></div><Link href="/committees">Manage committees</Link></div>
              <div className="committee-list">
                {Object.entries(capacities).map(([name, capacity], index) => {
                  const count = registrations.filter((registration) => registration.allottedCommittee === name).length;
                  const percent = Math.min(100, Math.round((count / capacity) * 100));
                  return (
                    <button className="committee-row clickable-row" key={name} type="button" onClick={() => jumpToRegistrations("all", name)}>
                      <span className={`committee-code c${(index % 4) + 1}`}>{name.split(" ").map((word) => word[0]).join("").slice(0, 2)}</span>
                      <div><strong>{name}</strong><small>{capacity} seats</small></div>
                      <div className="capacity"><span><b>{count}</b> / {capacity} seats</span><div className="bar"><i style={{ width: `${percent}%` }}></i></div></div>
                      <span className={`capacity-badge ${capacity - count < 10 ? "warning" : ""}`}>{capacity - count} left</span>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="panel resources-panel" id="resources">
              <div className="panel-head"><div><p className="eyebrow">DELEGATE FILES</p><h2>Resources</h2></div><span className="count-badge">{resources.length}</span></div>
              <form className="resource-manager" onSubmit={uploadResource}>
                <input name="title" placeholder="Resource title" required />
                <textarea name="description" placeholder="Short description" />
                <div className="resource-fields">
                  <select name="category" defaultValue="Committee Guide">
                    <option>Committee Guide</option>
                    <option>Rules</option>
                    <option>Schedule</option>
                    <option>Policy</option>
                    <option>Other</option>
                  </select>
                  <select name="accessLevel" defaultValue="Registered">
                    <option>Public</option>
                    <option>Registered</option>
                    <option>Approved</option>
                    <option>Allotted</option>
                  </select>
                </div>
                <input name="file" type="file" required />
                <button className="button secondary full" type="submit" disabled={isUploadingResource}>{isUploadingResource ? "Uploading..." : "Upload resource"}</button>
              </form>
              <div className="resource-admin-list">
                {resources.length ? resources.map((resource) => (
                  <article className="resource-admin-item" key={resource.id}>
                    <div>
                      <strong>{resource.title}</strong>
                      <small>{resource.category} - {resource.accessLevel}</small>
                      {resource.description ? <p>{resource.description}</p> : null}
                      <a href={resource.fileUrl} target="_blank">Open file</a>
                    </div>
                    <button className="row-action" type="button" disabled={deletingResourceId === resource.id} onClick={() => deleteResource(resource)}>
                      {deletingResourceId === resource.id ? "Deleting..." : "Delete"}
                    </button>
                  </article>
                )) : <div className="empty-state">No resources uploaded yet.</div>}
              </div>
            </section>
          </div>
        </section>
      </main>

      {active ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="dialog-head"><div><p className="eyebrow">REGISTRATION DETAIL</p><h2>{active.name}</h2></div><button onClick={() => setActive(null)}>x</button></div>
            <div className="detail-body">
              <div><strong>Delegate ID</strong><span>{active.publicId}</span></div>
              <div><strong>Email</strong><span>{active.email}</span></div>
              <div><strong>Phone</strong><span>{active.phone}</span></div>
              <div><strong>Institution</strong><span>{active.institution || "-"}</span></div>
              <div><strong>Preference 1</strong><span>{active.committee1} / {active.portfolio1 || "No portfolio"}</span></div>
              <div><strong>Payment proof</strong><span>{active.paymentProofUrl ? <a href={active.paymentProofUrl} target="_blank">Open proof</a> : "Not uploaded"}</span></div>
              <div className="qr-preview"><strong>QR Preview</strong><span>/verify/pass/{active.publicId}</span><b>{active.publicId.slice(-3)}</b></div>
            </div>
            <div className="allotment-editor">
              <label>Allotted committee<select value={committee} onChange={(event) => setCommittee(event.target.value)}><option value="">Select committee</option>{Object.keys(capacities).map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Allotted portfolio<input value={portfolio} onChange={(event) => setPortfolio(event.target.value)} placeholder="Country / role" /></label>
              <label className="wide">Admin note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note for this update" /></label>
            </div>
            <div className="dialog-actions action-wrap">
              <button className="button secondary" onClick={() => setActive(null)}>Close</button>
              <button className="button secondary" disabled={Boolean(activeAction)} onClick={() => patchActive("Payment rejection", { paymentStatus: "Rejected", registrationStatus: "Action Needed" })}>{activeAction === "Payment rejection" ? "Saving..." : "Reject payment"}</button>
              <button className="button secondary" disabled={Boolean(activeAction)} onClick={() => patchActive("Payment verification", { paymentStatus: "Verified" })}>{activeAction === "Payment verification" ? "Saving..." : "Verify payment"}</button>
              <button className="button secondary" disabled={Boolean(activeAction)} onClick={() => patchActive("Registration approval", { paymentStatus: "Verified", registrationStatus: "Approved" })}>{activeAction === "Registration approval" ? "Saving..." : "Approve"}</button>
              <button className="button primary" disabled={Boolean(activeAction)} onClick={() => patchActive("Allotment release", { paymentStatus: "Verified", registrationStatus: "Approved", allotmentStatus: "Allotted", allottedCommittee: committee || "", allottedPortfolio: portfolio || "" })}>{activeAction === "Allotment release" ? "Saving..." : "Release allotment"}</button>
            </div>
            {active.notes?.length ? <div className="notes-list"><h3>Admin notes</h3>{active.notes.map((item) => <p key={item.id}>{item.note}</p>)}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
