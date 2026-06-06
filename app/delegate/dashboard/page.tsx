import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/SiteHeader";
import { getDelegateRegistrationId } from "../../../lib/delegate";
import { prisma } from "../../../lib/prisma";
import { isSafeExternalUrl } from "../../../lib/security";
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

  const isDelegation = registration.registrationType === "delegation";
  const hasAllotment = registration.allotmentStatus === "Allotted" || 
    (isDelegation && registration.registrationStatus === "Approved");
  const timelineSteps = [
    { label: "Registered", active: Boolean(registration.publicId), detail: registration.publicId },
    { label: "Payment", active: registration.paymentStatus === "Verified", detail: registration.paymentStatus },
    { label: "Approved", active: registration.registrationStatus === "Approved", detail: registration.registrationStatus },
    { label: isDelegation ? "Group Ready" : "Allotted", active: hasAllotment, detail: isDelegation ? (registration.registrationStatus === "Approved" ? "Approved" : "Pending") : registration.allotmentStatus },
    { label: "QR Ready", active: hasAllotment, detail: hasAllotment ? "Ready" : "Locked" }
  ];
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
        <section className="subpage-hero cinematic-subpage dashboard-hero">
          <p className="eyebrow">DELEGATE DASHBOARD</p>
          <h1>Welcome, {registration.name}.</h1>
          <p>Your private dashboard shows only your registration, payment, allotment, QR pass, resources, and announcements.</p>
          <div className="hero-actions">
            <LogoutButton />
          </div>
        </section>
        <section className="section delegate-dashboard">
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
                  <div className="qr-link">
                    <img className="qr-code-image" src={`/api/qr/${registration.publicId}`} alt={`QR pass for ${registration.publicId}`} />
                    <strong>{registration.name}</strong>
                    <span>{isDelegation ? "Delegation Group Pass" : `${registration.allottedCommittee} - ${registration.allottedPortfolio}`}</span>
                    <small style={{ color: "var(--muted)" }}>/verify/pass/{registration.publicId}</small>
                  </div>
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
                  isSafeExternalUrl(resource.fileUrl) ? (
                  <a key={resource.id} href={`/api/resources/${resource.id}/download`} download>
                    <strong>{resource.title}</strong>
                    <span>{resource.category} - {resource.accessLevel}</span>
                  </a>
                  ) : null
                )) : <p className="empty-copy">No resources have been released for your current status yet.</p>}
              </div>
            </article>
            <article className="dashboard-card">
              <h2>Certificates</h2>
              <div className="resource-list compact">
                {(() => {
                  const participationCert = certificates.find((c) => c.title === "Certificate of Participation");
                  const otherCerts = certificates.filter((c) => c.title !== "Certificate of Participation");

                  return (
                    <>
                      {participationCert ? (
                        <div className="certificate-item-card" style={{ marginBottom: "15px" }}>
                          <strong>Certificate of Participation</strong>
                          <span className="cert-code" style={{ display: "block", fontSize: "0.85em", color: "var(--text-muted)", margin: "4px 0 12px" }}>
                            {participationCert.certificateNo}
                          </span>
                          <div className="cert-actions-row" style={{ display: "flex", gap: "8px" }}>
                            <Link href={`/certificates/${participationCert.certificateNo}`} className="button secondary" style={{ fontSize: "0.85em", padding: "6px 12px" }}>
                              View Certificate
                            </Link>
                            <a href={`/api/certificates/${participationCert.certificateNo}/download`} className="button primary" style={{ fontSize: "0.85em", padding: "6px 12px" }} target="_blank" rel="noopener noreferrer">
                              Download PDF
                            </a>
                          </div>
                        </div>
                      ) : registration.checkedIn ? (
                        <p className="empty-copy">Certificate will be available after admin issuance.</p>
                      ) : (
                        <p className="empty-copy">Participation certificate unlocks after event check-in.</p>
                      )}

                      {otherCerts.length > 0 && (
                        <div className="other-certs-section" style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid var(--border)" }}>
                          <h3 style={{ fontSize: "1em", marginBottom: "10px" }}>Other Certificates</h3>
                          {otherCerts.map((certificate) => (
                            <div key={certificate.id} className="certificate-item-card" style={{ marginBottom: "10px" }}>
                              <strong>{certificate.title}</strong>
                              <span className="cert-code" style={{ display: "block", fontSize: "0.85em", color: "var(--text-muted)", margin: "4px 0 8px" }}>
                                {certificate.certificateNo}
                              </span>
                              <Link href={`/certificates/${certificate.certificateNo}`} className="button secondary" style={{ fontSize: "0.85em", padding: "6px 12px", display: "inline-block" }}>
                                View Certificate
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
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
