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
  id: string;
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
  checkedIn: boolean;
  checkedInAt?: string | null;
  checkedInBy?: string | null;
  certificateReleased: boolean;
  certificateReleasedAt?: string | null;
  certificateUrl?: string | null;
  notes?: Note[];
  
  // New columns
  registrationType?: string | null;
  accommodationRequired?: boolean;
  paymentScreenshotUrl?: string | null;
  totalAmountPaid?: number;
  age?: number | null;
  dob?: string | null;
  gender?: string | null;
  gradeYear?: string | null;
  portfolio2?: string | null;
  city?: string | null;
  isPartOfDelegation?: boolean;
  delegationName?: string | null;
  refPerson?: string | null;
  coTeacherName?: string | null;
  coTeacherPhone?: string | null;
  coTeacherEmail?: string | null;
  totalDelegates?: number | null;
  delegateNames?: string | null;
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

type EBProfile = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  committee: string;
  position: string;
  bio: string;
  instagram?: string | null;
  linkedin?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Testimonial = {
  id: string;
  name: string;
  institution: string;
  quote: string;
  edition?: string | null;
  photoUrl?: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

type Announcement = {
  id: string;
  title: string;
  audience: string;
  message: string;
  createdAt: string;
};

type AnalyticsSummary = {
  registrations: number;
  verifiedPayments: number;
  checkedIn: number;
  resources: number;
  certificates: number;
  awards: number;
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
  if (emailStatus === "sent-test") return `${action} for ${name}, and test email sent.`;
  if (emailStatus === "failed") return `${action} for ${name}, but email failed.`;
  if (emailStatus === "skipped") return `${action} for ${name}. Email skipped because Resend is not configured.`;
  return `${action} saved for ${name}.`;
}

export function PortalClient() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [needsAdminSetup, setNeedsAdminSetup] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [ebProfiles, setEbProfiles] = useState<EBProfile[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [regTypeFilter, setRegTypeFilter] = useState<"all" | "individual" | "delegation">("all");
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
  const [isSavingEb, setIsSavingEb] = useState(false);
  const [editingEb, setEditingEb] = useState<EBProfile | null>(null);
  const [isSavingTestimonial, setIsSavingTestimonial] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [isCreatingAdminUser, setIsCreatingAdminUser] = useState(false);
  const [isSavingOps, setIsSavingOps] = useState(false);
  const [adminCertificates, setAdminCertificates] = useState<any[]>([]);
  const [isGeneratingCerts, setIsGeneratingCerts] = useState(false);
  const [certGenResult, setCertGenResult] = useState<{
    totalCheckedIn: number;
    eligible: number;
    created: number;
    skippedExisting: number;
    ineligible: number;
    errors: string[];
  } | null>(null);
  const [deletingResourceId, setDeletingResourceId] = useState("");
  const [deletingEbId, setDeletingEbId] = useState("");
  const [deletingTestimonialId, setDeletingTestimonialId] = useState("");
  const [announcement, setAnnouncement] = useState({ title: "", audience: "All registered delegates", message: "" });

  async function unlockWithAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminEmail.trim() || !adminPassword) {
      setMessage("Enter admin email and password.");
      setMessageType("error");
      return;
    }
    setIsUnlocking(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch("/api/admin/user-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Invalid admin account.");
        setMessageType("error");
        return;
      }
      setIsUnlocked(true);
      setMessage("Admin account unlocked.");
      setMessageType("success");
      await loadRegistrations();
      await loadResources();
      await loadEbProfiles();
      await loadTestimonials();
      await loadAdminUsers();
      await loadAnalytics();
      await loadAdminCertificates();
      await loadAnnouncements();
    } catch {
      setMessage("Could not reach the admin account server.");
      setMessageType("error");
    } finally {
      setIsUnlocking(false);
    }
  }

  async function bootstrapAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsUnlocking(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupToken: formData.get("setupToken"),
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password")
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not create first admin.");
        setMessageType("error");
        return;
      }
      setNeedsAdminSetup(false);
      setAdminEmail(String(formData.get("email") || ""));
      setMessage("First admin created. Log in with that admin account.");
      setMessageType("success");
      event.currentTarget.reset();
    } catch {
      setMessage("Could not reach the admin setup server.");
      setMessageType("error");
    } finally {
      setIsUnlocking(false);
    }
  }

  useEffect(() => {
    fetch("/api/admin/bootstrap")
      .then((response) => response.json())
      .then((payload) => setNeedsAdminSetup(Boolean(payload.needsSetup)))
      .catch(() => setNeedsAdminSetup(false));
  }, []);

  async function loadAnnouncements() {
    try {
      const response = await fetch("/api/announcements");
      const payload = await response.json();
      if (response.ok) {
        setAnnouncements(payload.announcements || []);
      }
    } catch {
      setAnnouncements([]);
    }
  }

  async function deleteAnnouncement(announcementId: string) {
    setDeletingAnnouncementId(announcementId);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch(`/api/announcements/${announcementId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not delete announcement.");
        setMessageType("error");
        return;
      }
      setMessage("Announcement deleted.");
      setMessageType("success");
      await loadAnnouncements();
    } catch {
      setMessage("Could not connect to announcement server.");
      setMessageType("error");
    } finally {
      setDeletingAnnouncementId("");
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

  async function loadEbProfiles() {
    try {
      const response = await fetch("/api/eb-profiles");
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not load EB profiles.");
        setMessageType("error");
        return;
      }
      setEbProfiles(payload.profiles || []);
    } catch {
      setMessage("Could not load EB profiles.");
      setMessageType("error");
    }
  }

  async function loadTestimonials() {
    try {
      const response = await fetch("/api/testimonials?all=true");
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not load testimonials.");
        setMessageType("error");
        return;
      }
      setTestimonials(payload.testimonials || []);
    } catch {
      setMessage("Could not load testimonials.");
      setMessageType("error");
    }
  }

  async function loadAdminUsers() {
    try {
      const response = await fetch("/api/admin/users");
      const payload = await response.json();
      if (!response.ok) return;
      setAdminUsers(payload.users || []);
    } catch {
      setAdminUsers([]);
    }
  }

  async function loadAnalytics() {
    try {
      const response = await fetch("/api/admin/analytics");
      const payload = await response.json();
      if (response.ok) setAnalytics(payload);
    } catch {
      setAnalytics(null);
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

  async function loadAdminCertificates() {
    try {
      const response = await fetch("/api/certificates");
      const payload = await response.json();
      if (response.ok) {
        setAdminCertificates(payload.certificates || []);
      }
    } catch {
      setAdminCertificates([]);
    }
  }

  async function generateParticipationCerts() {
    setIsGeneratingCerts(true);
    setMessage("");
    setMessageType("");
    setCertGenResult(null);
    try {
      const response = await fetch("/api/admin/certificates/participation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not generate certificates.");
        setMessageType("error");
        return;
      }
      setCertGenResult(payload);
      setMessage("Participation certificates processed successfully.");
      setMessageType("success");
      await loadAnalytics();
      await loadAdminCertificates();
      await loadRegistrations();
    } catch {
      setMessage("Could not reach the certificate generation server.");
      setMessageType("error");
    } finally {
      setIsGeneratingCerts(false);
    }
  }

  async function issueParticipationCertForDelegate(publicId: string) {
    setIsSavingOps(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId, title: "Certificate of Participation" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not issue participation certificate.");
        setMessageType("error");
        return;
      }
      setMessage(`Participation certificate issued: ${payload.certificate.certificateNo}.`);
      setMessageType("success");
      await loadAnalytics();
      await loadAdminCertificates();
      await loadRegistrations();
    } catch {
      setMessage("Could not connect to certificate server.");
      setMessageType("error");
    } finally {
      setIsSavingOps(false);
    }
  }

  useEffect(() => {
    if (isUnlocked) {
      void loadRegistrations();
      void loadResources();
      void loadEbProfiles();
      void loadTestimonials();
      void loadAdminUsers();
      void loadAnalytics();
      void loadAdminCertificates();
      void loadAnnouncements();
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
    const typeMatch =
      regTypeFilter === "all" ||
      registration.registrationType === regTypeFilter;
    return filterMatch && committeeMatch && typeMatch;
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
    setRegTypeFilter("all");
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
      await loadAnnouncements();
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

  async function sendTestEmail() {
    setIsSendingTestEmail(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch("/api/admin/test-email", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not send test email.");
        setMessageType("error");
        return;
      }
      const label = payload.emailStatus === "sent-test" ? "test email sent to TEST_EMAIL_TO" : `email status: ${payload.emailStatus}`;
      setMessage(`Resend test complete: ${label}.`);
      setMessageType("success");
    } catch {
      setMessage("Could not reach the test email server.");
      setMessageType("error");
    } finally {
      setIsSendingTestEmail(false);
    }
  }

  async function saveEbProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsSavingEb(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch(editingEb ? `/api/eb-profiles/${editingEb.id}` : "/api/eb-profiles", {
        method: editingEb ? "PATCH" : "POST",
        body: formData
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not save EB profile.");
        setMessageType("error");
        return;
      }
      setMessage(editingEb ? "EB profile updated." : "EB profile created.");
      setMessageType("success");
      setEditingEb(null);
      form.reset();
      await loadEbProfiles();
    } catch {
      setMessage("Could not reach the EB profile server.");
      setMessageType("error");
    } finally {
      setIsSavingEb(false);
    }
  }

  async function deleteEbProfile(profile: EBProfile) {
    setDeletingEbId(profile.id);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch(`/api/eb-profiles/${profile.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not delete EB profile.");
        setMessageType("error");
        return;
      }
      setMessage(`Deleted EB profile: ${profile.fullName}.`);
      setMessageType("success");
      if (editingEb?.id === profile.id) setEditingEb(null);
      await loadEbProfiles();
    } catch {
      setMessage("Could not reach the EB delete server.");
      setMessageType("error");
    } finally {
      setDeletingEbId("");
    }
  }

  async function saveTestimonial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = {
      name: String(formData.get("name") || "").trim(),
      institution: String(formData.get("institution") || "").trim(),
      quote: String(formData.get("quote") || "").trim(),
      edition: String(formData.get("edition") || "").trim(),
      photoUrl: String(formData.get("photoUrl") || "").trim(),
      isPublished: formData.get("isPublished") === "on"
    };
    setIsSavingTestimonial(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch(editingTestimonial ? `/api/testimonials/${editingTestimonial.id}` : "/api/testimonials", {
        method: editingTestimonial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not save testimonial.");
        setMessageType("error");
        return;
      }
      setMessage(editingTestimonial ? "Testimonial updated." : "Testimonial created.");
      setMessageType("success");
      setEditingTestimonial(null);
      form.reset();
      await loadTestimonials();
    } catch {
      setMessage("Could not reach the testimonial server.");
      setMessageType("error");
    } finally {
      setIsSavingTestimonial(false);
    }
  }

  async function patchTestimonial(testimonial: Testimonial, patch: Partial<Testimonial>) {
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch(`/api/testimonials/${testimonial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not update testimonial.");
        setMessageType("error");
        return;
      }
      setMessage("Testimonial visibility updated.");
      setMessageType("success");
      await loadTestimonials();
    } catch {
      setMessage("Could not reach the testimonial update server.");
      setMessageType("error");
    }
  }

  async function deleteTestimonial(testimonial: Testimonial) {
    setDeletingTestimonialId(testimonial.id);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch(`/api/testimonials/${testimonial.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not delete testimonial.");
        setMessageType("error");
        return;
      }
      setMessage(`Deleted testimonial: ${testimonial.name}.`);
      setMessageType("success");
      if (editingTestimonial?.id === testimonial.id) setEditingTestimonial(null);
      await loadTestimonials();
    } catch {
      setMessage("Could not reach the testimonial delete server.");
      setMessageType("error");
    } finally {
      setDeletingTestimonialId("");
    }
  }

  async function createAdminUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsCreatingAdminUser(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") || "").trim(),
          email: String(formData.get("email") || "").trim(),
          password: String(formData.get("password") || ""),
          role: String(formData.get("role") || "Admin").trim()
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not create admin user.");
        setMessageType("error");
        return;
      }
      form.reset();
      setMessage("Admin user created.");
      setMessageType("success");
      await loadAdminUsers();
    } catch {
      setMessage("Could not reach the admin user server.");
      setMessageType("error");
    } finally {
      setIsCreatingAdminUser(false);
    }
  }

  async function saveCertificate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsSavingOps(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: formData.get("publicId"), title: formData.get("title") })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not issue certificate.");
        setMessageType("error");
        return;
      }
      form.reset();
      setMessage(`Certificate issued: ${payload.certificate.certificateNo}.`);
      setMessageType("success");
      await loadAnalytics();
      await loadAdminCertificates();
    } finally {
      setIsSavingOps(false);
    }
  }

  async function saveAward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsSavingOps(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch("/api/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData))
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not save award.");
        setMessageType("error");
        return;
      }
      form.reset();
      setMessage("Award saved.");
      setMessageType("success");
      await loadAnalytics();
    } finally {
      setIsSavingOps(false);
    }
  }

  async function sendWhatsAppTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSavingOps(true);
    setMessage("");
    setMessageType("");
    try {
      const response = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.get("phone") })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not run WhatsApp test.");
        setMessageType("error");
        return;
      }
      setMessage(`WhatsApp test status: ${payload.whatsappStatus}.`);
      setMessageType(payload.whatsappStatus === "failed" ? "error" : "success");
    } finally {
      setIsSavingOps(false);
    }
  }

  if (!isUnlocked) {
    return (
      <main className="portal-unlock">
        <form className="registration-aside unlock-card" onSubmit={unlockWithAccount}>
          <h2>Admin Account</h2>
          <p>Sign in with your admin email and password.</p>
          <input value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} type="email" placeholder="Admin email" autoComplete="email" />
          <input value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} type="password" placeholder="Admin password" autoComplete="current-password" />
          <button className="button primary" type="submit" disabled={isUnlocking}>{isUnlocking ? "Signing in..." : "Login with Account"}</button>
          {message ? <p className={`form-message ${messageType}`} role="status">{message}</p> : null}
        </form>
        {needsAdminSetup ? (
          <form className="registration-aside unlock-card" onSubmit={bootstrapAdmin}>
            <h2>First Admin Setup</h2>
            <p>Create the first admin account using `ADMIN_SETUP_TOKEN` from the environment.</p>
            <input name="setupToken" type="password" placeholder="Setup token" autoComplete="one-time-code" required />
            <input name="name" placeholder="Admin name" required />
            <input name="email" type="email" placeholder="Admin email" required />
            <input name="password" type="password" placeholder="Password, 8+ characters" required />
            <button className="button secondary" type="submit" disabled={isUnlocking}>{isUnlocking ? "Creating..." : "Create First Admin"}</button>
          </form>
        ) : null}
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
          <Link className="nav-item" href="/admin-portal/check-in"><span className="nav-icon">Q</span> QR Check-in</Link>
          <button className="nav-item active" type="button" onClick={() => clearView()}><span className="nav-icon">O</span> Overview</button>
          <button className="nav-item" type="button" onClick={() => jumpToRegistrations("all")}><span className="nav-icon">R</span> Registrations <b>{registrations.length}</b></button>
          <button className="nav-item" type="button" onClick={() => jumpToRegistrations("payments")}><span className="nav-icon">P</span> Payments <b>{stats.needsPayment}</b></button>
          <button className="nav-item" type="button" onClick={() => jumpToRegistrations("allotments")}><span className="nav-icon">A</span> Allotments <b>{stats.needsAllotment}</b></button>
          <button className="nav-item" type="button" onClick={() => document.querySelector("#resources")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span className="nav-icon">D</span> Resources <b>{resources.length}</b></button>
          <button className="nav-item" type="button" onClick={() => document.querySelector("#announcements")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span className="nav-icon">N</span> Announcements <b>{announcements.length}</b></button>
          <button className="nav-item" type="button" onClick={() => document.querySelector("#eb-management")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span className="nav-icon">E</span> EB <b>{ebProfiles.length}</b></button>
          <button className="nav-item" type="button" onClick={() => document.querySelector("#testimonials")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span className="nav-icon">T</span> Testimonials <b>{testimonials.length}</b></button>
          <button className="nav-item" type="button" onClick={() => document.querySelector("#admin-users")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span className="nav-icon">U</span> Admin Users <b>{adminUsers.length}</b></button>
          <button className="nav-item" type="button" onClick={() => document.querySelector("#ops-tools")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span className="nav-icon">X</span> Ops Tools</button>
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
            <div className="heading-actions"><Link className="button primary" href="/admin-portal/check-in">QR Check-in</Link><button className="button secondary" type="button" onClick={sendTestEmail} disabled={isSendingTestEmail}>{isSendingTestEmail ? "Sending..." : "Send Test Email"}</button><button className="button secondary" type="button" onClick={clearView}>Clear view</button><a className="button secondary" href="/api/export/registrations.csv">Export CSV</a></div>
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
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <select
                    value={regTypeFilter}
                    onChange={(e) => setRegTypeFilter(e.target.value as any)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "#fff",
                      color: "var(--text)",
                      fontWeight: "600",
                      fontSize: "13px",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="all">All Registrations</option>
                    <option value="individual">Individual Registrations</option>
                    <option value="delegation">Delegation Registrations</option>
                  </select>
                  {(selectedCommittee || search || activeFilter !== "all" || regTypeFilter !== "all") ? <button className="filter-button" type="button" onClick={clearView}>Clear filters</button> : null}
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Delegate</th><th>Type</th><th>Preference</th><th>Payment</th><th>Status</th><th>Allotment</th><th>Check-in Status</th><th>Certificate Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={9}><div className="empty-state">Loading registrations...</div></td></tr>
                    ) : visible.length ? visible.map((registration, index) => (
                      <tr key={registration.publicId}>
                        <td>
                          <div className="delegate">
                            <span className={`avatar ${["purple", "pink", "blue", "gold"][index % 4]}`}>{initials(registration.name)}</span>
                            <span>
                              <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                {registration.name}
                                <span style={{
                                  fontSize: "0.75em",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontWeight: "bold",
                                  background: registration.registrationType === "delegation" ? "rgba(109, 67, 200, 0.15)" : "rgba(0, 128, 255, 0.1)",
                                  color: registration.registrationType === "delegation" ? "var(--purple)" : "#0080ff"
                                }}>
                                  {registration.registrationType === "delegation" ? "Delegation" : "Individual"}
                                </span>
                              </strong>
                              <small>{registration.institution || registration.email}</small>
                            </span>
                          </div>
                        </td>
                        <td>{registration.type}</td>
                        <td>{registration.committee1}</td>
                        <td><span className={`status ${statusClass(registration.paymentStatus)}`}>{registration.paymentStatus}</span></td>
                        <td><span className={`status ${statusClass(registration.registrationStatus)}`}>{registration.registrationStatus}</span></td>
                        <td><span className={`status ${statusClass(registration.allotmentStatus)}`}>{registration.allotmentStatus}</span></td>
                        <td>
                          <span className={`status ${registration.checkedIn ? "verified" : "pending"}`}>
                            {registration.checkedIn ? "Checked In" : "Not Checked In"}
                          </span>
                        </td>
                        <td>
                          <span className={`status ${registration.certificateReleased ? "verified" : "pending"}`}>
                            {registration.certificateReleased ? "Released" : "Not Released"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <button className="row-action" onClick={() => openRegistration(registration)}>Review</button>
                            {registration.certificateReleased ? (
                              <button className="button secondary small-btn" disabled style={{ fontSize: "0.8em", padding: "4px 8px", opacity: 0.7 }}>
                                Released
                              </button>
                            ) : registration.checkedIn ? (
                              <button 
                                className="button primary small-btn" 
                                disabled={isSavingOps}
                                onClick={() => issueParticipationCertForDelegate(registration.publicId)}
                                style={{ fontSize: "0.8em", padding: "4px 8px" }}
                              >
                                Release Certificate
                              </button>
                            ) : (
                              <button 
                                className="button secondary small-btn" 
                                disabled 
                                title="Certificate cannot be released because this delegate has not checked in yet."
                                style={{ fontSize: "0.8em", padding: "4px 8px", cursor: "not-allowed", opacity: 0.5 }}
                              >
                                Release Certificate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : <tr><td colSpan={9}><div className="empty-state">{registrations.length ? "No registrations match this view. Clear filters or search again." : "No registrations yet. New delegate submissions will appear here."}</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="panel attention-panel">
              <div className="panel-head"><div><p className="eyebrow">PRIORITY QUEUE</p><h2>Needs attention</h2></div><span className="count-badge">{stats.needsPayment + stats.needsAllotment}</span></div>
              <div className="attention-list">
                <button className="attention-item" onClick={() => jumpToRegistrations("payments")}><span className="attention-icon urgent">!</span><span><strong>{stats.needsPayment} payments pending</strong><small>Razorpay payments verify automatically</small></span><b>Open</b></button>
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
                <input name="file" type="file" accept=".pdf,.doc,.docx" required />
                <button className="button secondary full" type="submit" disabled={isUploadingResource}>{isUploadingResource ? "Uploading..." : "Upload resource"}</button>
              </form>
              <div className="resource-admin-list">
                {resources.length ? resources.map((resource) => (
                  <article className="resource-admin-item" key={resource.id}>
                    <div>
                      <strong>{resource.title}</strong>
                      <small>{resource.category} - {resource.accessLevel}</small>
                      {resource.description ? <p>{resource.description}</p> : null}
                      <a href={`/api/resources/${resource.id}/download`} download>Download file</a>
                    </div>
                    <button className="row-action" type="button" disabled={deletingResourceId === resource.id} onClick={() => deleteResource(resource)}>
                      {deletingResourceId === resource.id ? "Deleting..." : "Delete"}
                    </button>
                  </article>
                )) : <div className="empty-state">No resources uploaded yet.</div>}
              </div>
            </section>

            <section className="panel resources-panel" id="announcements">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">BROADCASTS</p>
                  <h2>Announcements</h2>
                </div>
                <span className="count-badge">{announcements.length}</span>
              </div>
              <form className="resource-manager" onSubmit={publishAnnouncement}>
                <input
                  value={announcement.title}
                  onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })}
                  placeholder="Announcement title"
                  required
                />
                <textarea
                  value={announcement.message}
                  onChange={(event) => setAnnouncement({ ...announcement, message: event.target.value })}
                  placeholder="Announcement message (supports markdown or plain text)"
                  required
                />
                <div className="resource-fields">
                  <select
                    value={announcement.audience}
                    onChange={(event) => setAnnouncement({ ...announcement, audience: event.target.value })}
                    required
                  >
                    <option value="All registered delegates">All registered delegates</option>
                    {Object.keys(capacities).map((committeeName) => (
                      <option key={committeeName} value={committeeName}>{committeeName}</option>
                    ))}
                  </select>
                </div>
                <button className="button secondary full" type="submit" disabled={isPublishing}>
                  {isPublishing ? "Publishing..." : "Publish announcement"}
                </button>
              </form>
              <div className="resource-admin-list">
                {announcements.length ? (
                  announcements.map((ann) => (
                    <article className="resource-admin-item" key={ann.id}>
                      <div>
                        <strong>{ann.title}</strong>
                        <small>{ann.audience} - {new Date(ann.createdAt).toLocaleString()}</small>
                        <p style={{ marginTop: "5px", color: "var(--text-muted)", fontSize: "0.9em", whiteSpace: "pre-wrap" }}>
                          {ann.message}
                        </p>
                      </div>
                      <button
                        className="row-action"
                        type="button"
                        disabled={deletingAnnouncementId === ann.id}
                        onClick={() => deleteAnnouncement(ann.id)}
                      >
                        {deletingAnnouncementId === ann.id ? "Deleting..." : "Delete"}
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">No announcements published yet.</div>
                )}
              </div>
            </section>
          </div>

          <div className="lower-grid">
            <section className="panel resources-panel" id="eb-management">
              <div className="panel-head"><div><p className="eyebrow">PUBLIC LEADERSHIP</p><h2>Executive Board</h2></div><span className="count-badge">{ebProfiles.length}</span></div>
              <form className="resource-manager" onSubmit={saveEbProfile}>
                <input name="fullName" placeholder="Full name" defaultValue={editingEb?.fullName || ""} required />
                <div className="resource-fields">
                  <input name="committee" placeholder="Committee" defaultValue={editingEb?.committee || ""} required />
                  <input name="position" placeholder="Position" defaultValue={editingEb?.position || ""} required />
                </div>
                <textarea name="bio" placeholder="Short bio" defaultValue={editingEb?.bio || ""} required />
                <div className="resource-fields">
                  <input name="email" placeholder="Email optional" defaultValue={editingEb?.email || ""} />
                  <input name="phone" placeholder="Phone optional" defaultValue={editingEb?.phone || ""} />
                </div>
                <div className="resource-fields">
                  <input name="instagram" placeholder="Instagram URL optional" defaultValue={editingEb?.instagram || ""} />
                  <input name="linkedin" placeholder="LinkedIn URL optional" defaultValue={editingEb?.linkedin || ""} />
                </div>
                <input name="photo" type="file" accept="image/*" />
                <div className="dialog-actions action-wrap">
                  <button className="button secondary full" type="submit" disabled={isSavingEb}>{isSavingEb ? "Saving..." : editingEb ? "Update EB profile" : "Create EB profile"}</button>
                  {editingEb ? <button className="button ghost" type="button" onClick={() => setEditingEb(null)}>Cancel edit</button> : null}
                </div>
              </form>
              <div className="resource-admin-list">
                {ebProfiles.length ? ebProfiles.map((profile) => (
                  <article className="resource-admin-item" key={profile.id}>
                    <div className="admin-list-with-photo">
                      {profile.photoUrl ? <img src={profile.photoUrl} alt={profile.fullName} /> : <span className="avatar purple">{initials(profile.fullName)}</span>}
                      <span><strong>{profile.fullName}</strong><small>{profile.committee} - {profile.position}</small><p>{profile.bio}</p></span>
                    </div>
                    <div className="dialog-actions action-wrap">
                      <button className="row-action" type="button" onClick={() => setEditingEb(profile)}>Edit</button>
                      <button className="row-action" type="button" disabled={deletingEbId === profile.id} onClick={() => deleteEbProfile(profile)}>{deletingEbId === profile.id ? "Deleting..." : "Delete"}</button>
                    </div>
                  </article>
                )) : <div className="empty-state">No EB profiles added yet.</div>}
              </div>
            </section>

            <section className="panel resources-panel" id="testimonials">
              <div className="panel-head"><div><p className="eyebrow">PUBLIC FEEDBACK</p><h2>Testimonials</h2></div><span className="count-badge">{testimonials.length}</span></div>
              <form className="resource-manager" onSubmit={saveTestimonial}>
                <input name="name" placeholder="Name" defaultValue={editingTestimonial?.name || ""} required />
                <input name="institution" placeholder="Institution" defaultValue={editingTestimonial?.institution || ""} required />
                <textarea name="quote" placeholder="Delegate quote" defaultValue={editingTestimonial?.quote || ""} required />
                <div className="resource-fields">
                  <input name="edition" placeholder="Edition optional" defaultValue={editingTestimonial?.edition || ""} />
                  <input name="photoUrl" placeholder="Photo URL optional" defaultValue={editingTestimonial?.photoUrl || ""} />
                </div>
                <label className="toggle-row"><input name="isPublished" type="checkbox" defaultChecked={editingTestimonial?.isPublished ?? true} /> Published on homepage</label>
                <div className="dialog-actions action-wrap">
                  <button className="button secondary full" type="submit" disabled={isSavingTestimonial}>{isSavingTestimonial ? "Saving..." : editingTestimonial ? "Update testimonial" : "Create testimonial"}</button>
                  {editingTestimonial ? <button className="button ghost" type="button" onClick={() => setEditingTestimonial(null)}>Cancel edit</button> : null}
                </div>
              </form>
              <div className="resource-admin-list">
                {testimonials.length ? testimonials.map((testimonial) => (
                  <article className="resource-admin-item" key={testimonial.id}>
                    <div>
                      <strong>{testimonial.name}</strong>
                      <small>{testimonial.institution} - {testimonial.isPublished ? "Published" : "Hidden"}</small>
                      <p>{testimonial.quote}</p>
                    </div>
                    <div className="dialog-actions action-wrap">
                      <button className="row-action" type="button" onClick={() => setEditingTestimonial(testimonial)}>Edit</button>
                      <button className="row-action" type="button" onClick={() => patchTestimonial(testimonial, { isPublished: !testimonial.isPublished })}>{testimonial.isPublished ? "Unpublish" : "Publish"}</button>
                      <button className="row-action" type="button" disabled={deletingTestimonialId === testimonial.id} onClick={() => deleteTestimonial(testimonial)}>{deletingTestimonialId === testimonial.id ? "Deleting..." : "Delete"}</button>
                    </div>
                  </article>
                )) : <div className="empty-state">No testimonials added yet.</div>}
              </div>
            </section>
          </div>

          <div className="lower-grid">
            <section className="panel resources-panel" id="admin-users">
              <div className="panel-head"><div><p className="eyebrow">ACCESS CONTROL</p><h2>Admin Users</h2></div><span className="count-badge">{adminUsers.length}</span></div>
              <form className="resource-manager" onSubmit={createAdminUser}>
                <input name="name" placeholder="Admin name" required />
                <input name="email" type="email" placeholder="Admin email" required />
                <div className="resource-fields">
                  <input name="password" type="password" placeholder="Password, 8+ characters" required />
                  <select name="role" defaultValue="Admin"><option>Admin</option><option>Super Admin</option><option>Finance</option><option>Operations</option></select>
                </div>
                <button className="button secondary full" type="submit" disabled={isCreatingAdminUser}>{isCreatingAdminUser ? "Creating..." : "Create admin user"}</button>
              </form>
              <div className="resource-admin-list">
                {adminUsers.length ? adminUsers.map((user) => (
                  <article className="resource-admin-item" key={user.id}>
                    <div><strong>{user.name}</strong><small>{user.email} - {user.role}</small></div>
                  </article>
                )) : <div className="empty-state">No admin users created yet.</div>}
              </div>
            </section>
            <section className="panel resources-panel" id="ops-tools">
              <div className="panel-head"><div><p className="eyebrow">FINAL MODULES</p><h2>Awards, Certificates, Analytics, WhatsApp</h2></div></div>
              <div className="stats-grid mini-stats">
                <article className="stat-card"><p>Registrations</p><h3>{analytics?.registrations ?? "-"}</h3></article>
                <article className="stat-card"><p>Checked in</p><h3>{analytics?.checkedIn ?? "-"}</h3></article>
                <article className="stat-card"><p>Certificates</p><h3>{analytics?.certificates ?? "-"}</h3></article>
                <article className="stat-card"><p>Awards</p><h3>{analytics?.awards ?? "-"}</h3></article>
              </div>
              <div className="resource-manager" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "20px", marginBottom: "20px" }}>
                <h3>Bulk Participation Certificates</h3>
                <p style={{ fontSize: "0.9em", color: "var(--text-muted)", marginBottom: "15px" }}>
                  Generate Certificates of Participation for all delegates who have checked in, paid, and have allotments.
                </p>
                <button 
                  className="button primary" 
                  type="button" 
                  disabled={isGeneratingCerts}
                  onClick={generateParticipationCerts}
                >
                  {isGeneratingCerts ? "Generating..." : "Generate Participation Certificates"}
                </button>
                {certGenResult && (
                  <div className="cert-summary-box" style={{ marginTop: "15px", padding: "12px", background: "var(--bg-accent)", borderRadius: "6px", fontSize: "0.9em" }}>
                    <h4 style={{ fontWeight: "bold", marginBottom: "6px" }}>Generation Summary</h4>
                    <ul style={{ listStyle: "disc", paddingLeft: "20px" }}>
                      <li>Total Checked-in: {certGenResult.totalCheckedIn}</li>
                      <li>Eligible: {certGenResult.eligible}</li>
                      <li>Created: {certGenResult.created}</li>
                      <li>Skipped (Already Issued): {certGenResult.skippedExisting}</li>
                      <li>Ineligible: {certGenResult.ineligible}</li>
                    </ul>
                    {certGenResult.errors && certGenResult.errors.length > 0 && (
                      <div style={{ marginTop: "8px", color: "var(--text-danger)" }}>
                        <strong>Errors:</strong>
                        <ul style={{ listStyle: "circle", paddingLeft: "20px" }}>
                          {certGenResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <form className="resource-manager" onSubmit={saveCertificate}>
                <h3>Issue certificate</h3>
                <input name="publicId" placeholder="Delegate ID, e.g. INV-2026-001" required />
                <input name="title" placeholder="Certificate title" defaultValue="Certificate of Participation" required />
                <button className="button secondary full" disabled={isSavingOps}>Issue certificate</button>
              </form>
              <form className="resource-manager" onSubmit={saveAward}>
                <h3>Add award</h3>
                <input name="publicId" placeholder="Delegate ID" required />
                <input name="title" placeholder="Award title" required />
                <div className="resource-fields"><input name="category" placeholder="Category" defaultValue="Committee Award" /><input name="position" placeholder="Position optional" /></div>
                <button className="button secondary full" disabled={isSavingOps}>Save award</button>
              </form>
              <form className="resource-manager" onSubmit={sendWhatsAppTest}>
                <h3>WhatsApp test</h3>
                <input name="phone" placeholder="Phone with country code" required />
                <button className="button secondary full" disabled={isSavingOps}>Send WhatsApp Test</button>
                <p className="empty-copy">Requires WhatsApp Cloud API env vars and approved template.</p>
              </form>
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
              <div><strong>Registration Type</strong>
                <span>
                  <span style={{
                    fontWeight: "bold",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: active.registrationType === "delegation" ? "rgba(109, 67, 200, 0.15)" : "rgba(0, 128, 255, 0.1)",
                    color: active.registrationType === "delegation" ? "var(--purple)" : "#0080ff"
                  }}>
                    {active.registrationType === "delegation" ? "Delegation" : "Individual"}
                  </span>
                </span>
              </div>
              <div><strong>Name / Delegation</strong><span>{active.name}</span></div>
              <div><strong>Email / Teacher Email</strong><span>{active.email}</span></div>
              <div><strong>Phone / Teacher Phone</strong><span>{active.phone}</span></div>
              <div><strong>Institution/School</strong><span>{active.institution || "Independent delegate"}</span></div>
              <div><strong>Committee</strong><span>{active.allottedCommittee || active.committee1}</span></div>
              {active.registrationType !== "delegation" && (
                <div><strong>Portfolio</strong><span>{active.allottedPortfolio || active.portfolio1 || "No portfolio"}</span></div>
              )}
              <div><strong>Total Fee Paid</strong><span>₹{(active.totalAmountPaid ?? active.amount).toLocaleString("en-IN")}</span></div>
              <div><strong>Accommodation?</strong><span>{active.accommodationRequired ? "Yes" : "No"}</span></div>
              
              {active.registrationType === "delegation" ? (
                <>
                  <div><strong>Co-ordinating Teacher</strong><span>{active.coTeacherName || "-"}</span></div>
                  <div><strong>City of Residence</strong><span>{active.city || "-"}</span></div>
                  <div><strong>Total Delegates</strong><span>{active.totalDelegates || "-"}</span></div>
                  <div className="wide" style={{ marginTop: "10px" }}>
                    <strong>Delegates Roster</strong>
                    <pre style={{
                      whiteSpace: "pre-wrap",
                      background: "#f6f6f6",
                      border: "1px solid var(--line)",
                      padding: "12px",
                      borderRadius: "8px",
                      marginTop: "5px",
                      fontFamily: "inherit",
                      maxHeight: "150px",
                      overflowY: "auto"
                    }}>
                      {active.delegateNames || "No roster provided"}
                    </pre>
                  </div>
                </>
              ) : (
                <>
                  <div><strong>Age</strong><span>{active.age || "-"}</span></div>
                  <div><strong>Date of Birth</strong><span>{active.dob || "-"}</span></div>
                  <div><strong>Gender</strong><span>{active.gender || "-"}</span></div>
                  <div><strong>Grade / Year</strong><span>{active.gradeYear || "-"}</span></div>
                  <div><strong>City of Residence</strong><span>{active.city || "-"}</span></div>
                  <div><strong>Part of Delegation?</strong><span>{active.isPartOfDelegation ? `Yes (${active.delegationName || ""})` : "No"}</span></div>
                  {active.refPerson && <div><strong>Reference Person</strong><span>{active.refPerson}</span></div>}
                </>
              )}

              <div><strong>Payment method</strong>
                <span>
                  {active.paymentScreenshotUrl ? (
                    <a href={active.paymentScreenshotUrl} target="_blank" rel="noopener noreferrer" className="button secondary small-btn" style={{ padding: "4px 8px", fontSize: "0.85em" }}>
                      Open Screenshot
                    </a>
                  ) : active.paymentProofUrl ? (
                    <a href={active.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="button secondary small-btn" style={{ padding: "4px 8px", fontSize: "0.85em" }}>
                      Open Legacy Proof
                    </a>
                  ) : (
                    "Razorpay online payment"
                  )}
                </span>
              </div>
              <div>
                <strong>Check-in Status</strong>
                <span>
                  {active.checkedIn ? (
                    <span className="status verified">
                      Checked In {active.checkedInBy ? `(by ${active.checkedInBy})` : ""}
                    </span>
                  ) : (
                    <span className="status pending">Not Checked In</span>
                  )}
                </span>
              </div>
              <div>
                <strong>Certificate Status</strong>
                <span>
                  <span className={`status ${active.certificateReleased ? "verified" : "pending"}`}>
                    {active.certificateReleased ? "Released" : "Not Released"}
                  </span>
                </span>
              </div>
              {active.registrationType !== "delegation" && (
                <div className="qr-preview"><strong>QR Preview</strong><span>/verify/pass/{active.publicId}</span><img src={`/api/qr/${active.publicId}`} alt={`QR pass for ${active.publicId}`} /></div>
              )}
            </div>
            <div className="allotment-editor">
              <label>Allotted committee<select value={committee} onChange={(event) => setCommittee(event.target.value)}><option value="">Select committee</option>{Object.keys(capacities).map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Allotted portfolio<input value={portfolio} onChange={(event) => setPortfolio(event.target.value)} placeholder="Country / role" /></label>
              <label className="wide">Admin note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note for this update" /></label>
              <p className="empty-copy wide">Admins can change the allotted committee or portfolio here, then save the allotment again. The delegate dashboard and QR pass update immediately from the database.</p>
            </div>
            <div className="dialog-actions action-wrap">
              <button className="button secondary" onClick={() => setActive(null)}>Close</button>
              {active.certificateReleased ? (
                <button className="button primary" disabled style={{ opacity: 0.7 }}>Released</button>
              ) : active.checkedIn ? (
                <button 
                  className="button primary" 
                  disabled={isSavingOps}
                  onClick={() => issueParticipationCertForDelegate(active.publicId)}
                >
                  {isSavingOps ? "Releasing..." : "Release Certificate"}
                </button>
              ) : (
                <div style={{ display: "inline-flex", flexDirection: "column", gap: "4px" }}>
                  <button 
                    className="button secondary" 
                    disabled 
                    title="Certificate cannot be released because this delegate has not checked in yet."
                    style={{ cursor: "not-allowed", opacity: 0.5 }}
                  >
                    Release Certificate
                  </button>
                  <small style={{ color: "var(--text-danger)", fontSize: "0.8em" }}>
                    Certificate cannot be released because this delegate has not checked in yet.
                  </small>
                </div>
              )}
              <button className="button secondary" disabled={Boolean(activeAction)} onClick={() => patchActive("Payment rejection", { paymentStatus: "Rejected", registrationStatus: "Action Needed" })}>{activeAction === "Payment rejection" ? "Saving..." : "Reject payment"}</button>
              <button className="button secondary" disabled={Boolean(activeAction)} onClick={() => patchActive("Payment verification", { paymentStatus: "Verified" })}>{activeAction === "Payment verification" ? "Saving..." : "Verify payment"}</button>
              <button className="button secondary" disabled={Boolean(activeAction)} onClick={() => patchActive("Registration approval", { paymentStatus: "Verified", registrationStatus: "Approved" })}>{activeAction === "Registration approval" ? "Saving..." : "Approve"}</button>
              <button className="button primary" disabled={Boolean(activeAction)} onClick={() => patchActive("Allotment release", { paymentStatus: "Verified", registrationStatus: "Approved", allotmentStatus: "Allotted", allottedCommittee: committee || "", allottedPortfolio: portfolio || "" })}>{activeAction === "Allotment release" ? "Saving..." : active.allotmentStatus === "Allotted" ? "Save allotment changes" : "Release allotment"}</button>
            </div>
            {active.notes?.length ? <div className="notes-list"><h3>Admin notes</h3>{active.notes.map((item) => <p key={item.id}>{item.note}</p>)}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
