import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/SiteHeader";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function CertificatePage({ params }: { params: { certificateNo: string } }) {
  // Try IndividualCertificate first
  const individualCert = await prisma.individualCertificate.findUnique({
    where: { certificateNo: params.certificateNo },
    include: { registration: true }
  });

  if (individualCert) {
    const reg = individualCert.registration;
    const issuedDate = individualCert.issuedAt ? new Date(individualCert.issuedAt) : null;
    const issuedDateStr = (issuedDate && !isNaN(issuedDate.getTime()))
      ? issuedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "—";

    return (
      <>
        <SiteHeader />
        <main>
          <section className="subpage-hero cinematic-subpage certificate-hero">
            <p className="eyebrow">VERIFIABLE CERTIFICATE</p>
            <h1>Official Invictus Recognition.</h1>
            <p>Each certificate is issued against a registered delegate record and can be verified through its certificate number.</p>
          </section>
          <section className="section certificate-page">
            <article className="certificate-card">
              <div className="verification-badge">
                <span className="status verified">Verified Certificate</span>
              </div>
              <p className="eyebrow">INVICTUS MUN 2026</p>
              <h1>{individualCert.title}</h1>
              <p className="cert-recipient-label">This certifies that</p>
              <h2>{reg.name}</h2>
              <p className="cert-details">
                participated in <strong>{reg.allottedCommittee || reg.committee1}</strong> as <strong>{reg.allottedPortfolio || reg.portfolio1 || "delegate"}</strong>.
              </p>
              <div className="certificate-metadata-grid">
                <div><span>Certificate Type</span><strong>{individualCert.title === "Certificate of Participation" ? "Participation" : individualCert.title}</strong></div>
                <div><span>Verification Code</span><strong>{individualCert.certificateNo}</strong></div>
                <div><span>Issued On</span><strong>{issuedDateStr}</strong></div>
                <div><span>Delegate ID</span><strong>{reg.publicId}</strong></div>
              </div>
              <div className="cert-actions">
                <a href={`/api/certificates/${individualCert.certificateNo}/download`} className="button primary" target="_blank" rel="noopener noreferrer">
                  Download PDF
                </a>
              </div>
            </article>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  // Try DelegateCertificate
  const delegateCert = await prisma.delegateCertificate.findUnique({
    where: { certificateNo: params.certificateNo },
    include: { delegate: { include: { delegation: true } } }
  });

  if (delegateCert) {
    const del = delegateCert.delegate;
    const issuedDate = delegateCert.issuedAt ? new Date(delegateCert.issuedAt) : null;
    const issuedDateStr = (issuedDate && !isNaN(issuedDate.getTime()))
      ? issuedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "—";

    return (
      <>
        <SiteHeader />
        <main>
          <section className="subpage-hero cinematic-subpage certificate-hero">
            <p className="eyebrow">VERIFIABLE CERTIFICATE</p>
            <h1>Official Invictus Recognition.</h1>
            <p>Each certificate is issued against a registered delegate record and can be verified through its certificate number.</p>
          </section>
          <section className="section certificate-page">
            <article className="certificate-card">
              <div className="verification-badge">
                <span className="status verified">Verified Certificate</span>
              </div>
              <p className="eyebrow">INVICTUS MUN 2026</p>
              <h1>{delegateCert.title}</h1>
              <p className="cert-recipient-label">This certifies that</p>
              <h2>{del.name}</h2>
              <p className="cert-details">
                participated in <strong>{del.allottedCommittee || del.committee1 || del.delegation.delegationName}</strong> as <strong>{del.allottedPortfolio || del.portfolio1 || "delegate"}</strong>.
              </p>
              <div className="certificate-metadata-grid">
                <div><span>Certificate Type</span><strong>{delegateCert.title === "Certificate of Participation" ? "Participation" : delegateCert.title}</strong></div>
                <div><span>Verification Code</span><strong>{delegateCert.certificateNo}</strong></div>
                <div><span>Issued On</span><strong>{issuedDateStr}</strong></div>
                <div><span>Delegate ID</span><strong>{del.publicId}</strong></div>
              </div>
              <div className="cert-actions">
                <a href={`/api/certificates/${delegateCert.certificateNo}/download`} className="button primary" target="_blank" rel="noopener noreferrer">
                  Download PDF
                </a>
              </div>
            </article>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  notFound();
}
