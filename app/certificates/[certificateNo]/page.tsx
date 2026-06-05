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
            <p className="eyebrow">INVICTUS MUN 2026</p>
            <h1>{certificate.title}</h1>
            <p>This certifies that</p>
            <h2>{certificate.registration.name}</h2>
            <p>participated in {certificate.registration.allottedCommittee || certificate.registration.committee1} as {certificate.registration.allottedPortfolio || certificate.registration.portfolio1 || "delegate"}.</p>
            <strong>{certificate.certificateNo}</strong>
          </article>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
