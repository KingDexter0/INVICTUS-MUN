import Link from "next/link";
import { SiteFooter, SiteHeader } from "../../../components/SiteHeader";
import { prisma } from "../../../../lib/prisma";
import { CheckInButton } from "./CheckInButton";

export const dynamic = "force-dynamic";

type VerifyPassPageProps = {
  params: {
    id: string;
  };
};

function formatDate(value?: Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export default async function VerifyPassPage({ params }: VerifyPassPageProps) {
  const registration = await prisma.registration.findUnique({
    where: { publicId: params.id }
  }).catch((error) => {
    console.error("Pass verification lookup unavailable", error);
    return null;
  });

  const isValid = Boolean(registration && registration.allotmentStatus === "Allotted");

  return (
    <>
      <SiteHeader cta="Check Status" ctaHref="/dashboard" />
      <main>
        <section className="subpage-hero cinematic-subpage verify-hero">
          <p className="eyebrow">QR VERIFICATION</p>
          <h1>{isValid ? "Valid delegate pass." : "Invalid or inactive pass."}</h1>
          <p>
            {isValid
              ? "This pass belongs to an allotted delegate. Event staff can check the delegate in below."
              : "This pass cannot be used for check-in. It may be missing, pending approval, or not allotted yet."}
          </p>
        </section>

        <section className="section verify-layout">
          <article className={`verify-card ${isValid ? "valid" : "invalid"}`}>
            <span className="verify-badge">{isValid ? "Valid Pass" : "Invalid Pass"}</span>
            {registration ? (
              <img className="qr-code-image verify-qr" src={`/api/qr/${registration.publicId}`} alt={`QR pass for ${registration.publicId}`} />
            ) : (
              <div className="qr-box verify-qr">--</div>
            )}
            <h2>{registration?.name || "Pass not found"}</h2>
            <p>{registration?.publicId || params.id}</p>
            {registration?.checkedIn ? <strong className="checked-pill">Checked in</strong> : null}
          </article>

          <article className="dashboard-card verify-details">
            <h2>Pass Details</h2>
            {registration ? (
              <>
                <dl>
                  {[
                    ["Delegate name", registration.name],
                    ["Delegate ID", registration.publicId],
                    ["Committee", registration.allottedCommittee || "Not released"],
                    ["Portfolio", registration.allottedPortfolio || "Not released"],
                    ["Payment status", registration.paymentStatus],
                    ["Registration status", registration.registrationStatus],
                    ["Allotment status", registration.allotmentStatus],
                    ["Check-in status", registration.checkedIn ? `Checked in at ${formatDate(registration.checkedInAt)}` : "Not checked in"]
                  ].map(([label, value]) => (
                    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                  ))}
                </dl>

                {isValid ? (
                  <CheckInButton
                    publicId={registration.publicId}
                    initialCheckedIn={registration.checkedIn}
                    initialCheckedInAt={registration.checkedInAt?.toISOString() || null}
                  />
                ) : (
                  <p className="form-message error">Check-in is locked until allotment is released.</p>
                )}
              </>
            ) : (
              <div className="empty-panel">
                <h2>Pass not found</h2>
                <p>No registration exists for this QR pass ID.</p>
                <Link className="button secondary" href="/dashboard">Check another registration</Link>
              </div>
            )}
          </article>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
