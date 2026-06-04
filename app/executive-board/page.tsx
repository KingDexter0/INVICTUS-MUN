import { SiteFooter, SiteHeader } from "../components/SiteHeader";
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function ExecutiveBoardPage() {
  const profiles = await prisma.eBProfile.findMany({
    orderBy: [{ committee: "asc" }, { position: "asc" }, { fullName: "asc" }]
  });
  const grouped = profiles.reduce<Record<string, typeof profiles>>((groups, profile) => {
    groups[profile.committee] = [...(groups[profile.committee] || []), profile];
    return groups;
  }, {});

  return (
    <>
      <SiteHeader />
      <main>
        <section className="subpage-hero">
          <p className="eyebrow">EXECUTIVE BOARD</p>
          <h1>The people guiding committee rooms.</h1>
          <p>Meet the chairs, vice chairs, moderators, and press leadership shaping Invictus MUN 2026.</p>
        </section>
        <section className="section eb-directory">
          {profiles.length ? Object.entries(grouped).map(([committee, members]) => (
            <div className="eb-group" key={committee}>
              <div className="section-head">
                <div><p className="eyebrow">{committee}</p><h2>{committee}</h2></div>
              </div>
              <div className="team-grid">
                {members.map((member) => (
                  <article className="eb-card" key={member.id}>
                    {member.photoUrl ? <img src={member.photoUrl} alt={member.fullName} /> : <div className="portrait">{member.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>}
                    <h3>{member.fullName}</h3>
                    <strong>{member.position}</strong>
                    <p>{member.bio}</p>
                    <div className="eb-links">
                      {member.instagram ? <a href={member.instagram} target="_blank">Instagram</a> : null}
                      {member.linkedin ? <a href={member.linkedin} target="_blank">LinkedIn</a> : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )) : (
            <div className="empty-panel">
              <h2>Executive Board coming soon</h2>
              <p>Profiles will appear here after the organizing team publishes them.</p>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

