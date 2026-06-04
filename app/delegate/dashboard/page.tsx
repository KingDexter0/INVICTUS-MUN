import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/SiteHeader";
import { getDelegateRegistrationId } from "../../../lib/delegate";
import { prisma } from "../../../lib/prisma";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function DelegateDashboardPage() {
  const registrationId = getDelegateRegistrationId();
  if (!registrationId) {
    redirect("/delegate/login");
  }

  const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!registration) {
    redirect("/delegate/login");
  }

  const [announcements, resources, certificates, awards] = await Promise.all([
    prisma.announcement.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.resource.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.certificate.findMany({ where: { registrationId: registration.id }, orderBy: { issuedAt: "desc" } }),
    prisma.award.findMany({ where: { registrationId: registration.id }, orderBy: { createdAt: "desc" } })
  ]);

  const hasAllotment = registration.allotmentStatus === "Allotted";
  const visibleResources = resources.filter((resource) => {
    if (resource.accessLevel === "Public" || resource.accessLevel === "Registered") return true;
    if (resource.accessLevel === "Approved") return registration.registrationStatus === "Approved";
    if (resource.accessLevel === "Allotted") return hasAllotment;
    return true;
  });

  return (
    <>
      <SiteHeader cta="Public Status" ctaHref="/dashboard" />
      <main>
        <section className="subpage-hero dashboard-hero">
          <p className="eyebrow">DELEGATE DASHBOARD</p>
          <h1>Welcome, {registration.name}.</h1>
          <p>Your private dashboard shows only your registration, payment, allotment, QR pass, resources, and announcements.</p>
          <div className="hero-actions">
            <LogoutButton />
          </div>
        </section>
        <section className="section delegate-dashboard">
          <div className="delegate-status-grid">
            <article><span>Registration</span><strong>{registration.registrationStatus}</strong></article>
            <article><span>Payment</span><strong>{registration.paymentStatus}</strong></article>
            <article><span>Allotment</span><strong>{registration.allotmentStatus}</strong></article>
            <article><span>QR Pass</span><strong>{hasAllotment ? "Ready" : "Locked"}</strong></article>
          </div>
          <div className="dashboard-detail-grid">
            <article className="dashboard-card">
              <h2>Personal Registration</h2>
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
                  ["Portfolio preference", registration.portfolio1 || "-"],
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
                  <Link className="qr-link" href={`/verify/pass/${registration.publicId}`}>
                    <img className="qr-code-image" src={`/api/qr/${registration.publicId}`} alt={`QR pass for ${registration.publicId}`} />
                    <strong>{registration.name}</strong>
                    <span>{registration.allottedCommittee} - {registration.allottedPortfolio}</span>
                    <small>/verify/pass/{registration.publicId}</small>
                  </Link>
                ) : (
                  <><div className="qr-box locked">--</div><strong>QR pass locked</strong><span>Approval and allotment required.</span></>
                )}
              </div>
            </article>
            <article className="dashboard-card">
              <h2>Announcements</h2>
              <div className="resource-list compact">
                {announcements.length ? announcements.map((announcement) => (
                  <a key={announcement.id} href="#">
                    <strong>{announcement.title}</strong>
                    <span>{announcement.audience}</span>
                  </a>
                )) : <p className="empty-copy">No announcements have been published yet.</p>}
              </div>
            </article>
            <article className="dashboard-card">
              <h2>Study Guides & Resources</h2>
              <div className="resource-list compact">
                {visibleResources.length ? visibleResources.map((resource) => (
                  <a key={resource.id} href={resource.fileUrl} target="_blank">
                    <strong>{resource.title}</strong>
                    <span>{resource.category} - {resource.accessLevel}</span>
                  </a>
                )) : <p className="empty-copy">No resources have been released for your current status yet.</p>}
              </div>
            </article>
            <article className="dashboard-card">
              <h2>Certificates</h2>
              <div className="resource-list compact">
                {certificates.length ? certificates.map((certificate) => (
                  <a key={certificate.id} href={`/certificates/${certificate.certificateNo}`}>
                    <strong>{certificate.title}</strong>
                    <span>{certificate.certificateNo}</span>
                  </a>
                )) : <p className="empty-copy">No certificates issued yet.</p>}
              </div>
            </article>
            <article className="dashboard-card">
              <h2>Awards</h2>
              <div className="resource-list compact">
                {awards.length ? awards.map((award) => (
                  <a key={award.id} href="#">
                    <strong>{award.title}</strong>
                    <span>{award.category}{award.position ? ` - ${award.position}` : ""}</span>
                  </a>
                )) : <p className="empty-copy">No awards assigned yet.</p>}
              </div>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
