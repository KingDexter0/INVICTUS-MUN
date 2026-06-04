import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/SiteHeader";
import { getEbProfileId } from "../../../lib/eb";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function EbDashboardPage() {
  const profileId = getEbProfileId();
  if (!profileId) redirect("/eb/login");
  const profile = await prisma.eBProfile.findUnique({ where: { id: profileId } });
  if (!profile) redirect("/eb/login");

  const registrations = await prisma.registration.findMany({
    where: { allottedCommittee: profile.committee },
    orderBy: { name: "asc" },
    select: { publicId: true, name: true, allottedPortfolio: true, registrationStatus: true, paymentStatus: true, checkedIn: true }
  });

  return (
    <>
      <SiteHeader />
      <main>
        <section className="subpage-hero">
          <p className="eyebrow">EB DASHBOARD</p>
          <h1>{profile.fullName}</h1>
          <p>{profile.position} - {profile.committee}</p>
        </section>
        <section className="section delegate-dashboard">
          <div className="dashboard-detail-grid">
            <article className="dashboard-card">
              <h2>Profile</h2>
              <dl>
                <div><dt>Committee</dt><dd>{profile.committee}</dd></div>
                <div><dt>Position</dt><dd>{profile.position}</dd></div>
                <div><dt>Email</dt><dd>{profile.email || "-"}</dd></div>
                <div><dt>Phone</dt><dd>{profile.phone || "-"}</dd></div>
              </dl>
            </article>
            <article className="dashboard-card">
              <h2>Committee Delegates</h2>
              <div className="resource-list compact">
                {registrations.length ? registrations.map((registration) => (
                  <a key={registration.publicId} href={`/verify/pass/${registration.publicId}`}>
                    <strong>{registration.name}</strong>
                    <span>{registration.allottedPortfolio || "Portfolio pending"} - {registration.checkedIn ? "Checked in" : "Not checked in"}</span>
                  </a>
                )) : <p className="empty-copy">No allotted delegates for this committee yet.</p>}
              </div>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

