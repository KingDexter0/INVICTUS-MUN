import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/SiteHeader";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function CertificatePage({ params }: { params: { certificateNo: string } }) {
  const certificate = await prisma.certificate.findUnique({
    where: { certificateNo: params.certificateNo },
    include: { registration: true }
  });
  if (!certificate) notFound();

  const issuedDateStr = new Date(certificate.issuedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

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
            <h1>{certificate.title}</h1>
            <p className="cert-recipient-label">This certifies that</p>
            <h2>{certificate.registration.name}</h2>
            <p className="cert-details">
              participated in <strong>{certificate.registration.allottedCommittee || certificate.registration.committee1}</strong> as <strong>{certificate.registration.allottedPortfolio || certificate.registration.portfolio1 || "delegate"}</strong>.
            </p>
            
            <div className="certificate-metadata-grid">
              <div>
                <span>Certificate Type</span>
                <strong>{certificate.title === "Certificate of Participation" ? "Participation" : certificate.title}</strong>
              </div>
              <div>
                <span>Verification Code</span>
                <strong>{certificate.certificateNo}</strong>
              </div>
              <div>
                <span>Issued On</span>
                <strong>{issuedDateStr}</strong>
              </div>
              <div>
                <span>Delegate ID</span>
                <strong>{certificate.registration.publicId}</strong>
              </div>
            </div>

            <div className="cert-actions">
              <a 
                href={`/api/certificates/${certificate.certificateNo}/download`} 
                className="button primary"
                target="_blank"
                rel="noopener noreferrer"
              >
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
