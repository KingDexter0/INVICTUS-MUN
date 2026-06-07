import { SiteFooter, SiteHeader } from "../components/SiteHeader";
import { prisma } from "../../lib/prisma";
import { sanitizeOptionalImageUrl, sanitizeOptionalSocialUrl } from "../../lib/security";
import { BoardPosterCard } from "./BoardPosterCard";

export const dynamic = "force-dynamic";

const localBoardPosters = [
  { name: "Aditya Kiran", committee: "UNGA-ESS", position: "Chairperson", image: "/local-media/executive-board/aditya-kiran.png" },
  { name: "Darshan Kamat", committee: "UNHRC", position: "Chairperson", image: "/local-media/executive-board/darshan-kamat.png" },
  { name: "Sagar Samanta", committee: "UNHRC", position: "Vice-Chairperson", image: "/local-media/executive-board/sagar-samanta.png" },
  { name: "Ganga Pramod", committee: "UNCSW", position: "Chairperson", image: "/local-media/executive-board/ganga-pramod.png" },
  { name: "Mehek Singh", committee: "UNCSW", position: "Vice-Chairperson", image: "/local-media/executive-board/mehek-singh.png" },
  { name: "Mohil Mehra", committee: "Arab League", position: "Chairperson", image: "/local-media/executive-board/mohil-mehra.png" },
  { name: "Paarth Veturkar", committee: "Arab League", position: "Vice-Chairperson", image: "/local-media/executive-board/paarth-veturkar.png" },
  { name: "Ishan Khare", committee: "International Press", position: "Head of Journalism", image: "/local-media/executive-board/ishan-khare.png" },
  { name: "Preeti Pania", committee: "International Press", position: "Head of Photography", image: "/local-media/executive-board/preeti-pania.png" }
];

async function getSafeEbProfiles() {
  try {
    const profiles = await prisma.eBProfile.findMany({
      orderBy: [{ committee: "asc" }, { position: "asc" }, { fullName: "asc" }]
    });

    return profiles.map((profile) => ({
      ...profile,
      photoUrl: sanitizeOptionalImageUrl(profile.photoUrl),
      instagram: sanitizeOptionalSocialUrl(profile.instagram, ["instagram.com"]),
      linkedin: sanitizeOptionalSocialUrl(profile.linkedin, ["linkedin.com"])
    }));
  } catch (error) {
    console.error("Executive board profiles unavailable", error);
    return [];
  }
}

export default async function ExecutiveBoardPage() {
  const safeProfiles = await getSafeEbProfiles();
  const grouped = safeProfiles.reduce<Record<string, typeof safeProfiles>>((groups, profile) => {
    groups[profile.committee] = [...(groups[profile.committee] || []), profile];
    return groups;
  }, {});

  return (
    <>
      <SiteHeader />
      <main>
        <section className="subpage-hero cinematic-subpage executive-hero">
          <p className="eyebrow">EXECUTIVE BOARD</p>
          <h1>Authority in the committee room.</h1>
          <p>Meet the chairs, vice chairs, moderators, and press leadership shaping Invictus MUN 2026 with procedure, restraint, and institutional credibility.</p>
        </section>
        <section className="section eb-directory">
          {safeProfiles.length ? Object.entries(grouped).map(([committee, members]) => (
            <div className="eb-group" key={committee} style={{ marginBottom: "40px" }}>
              <div className="section-head">
                <div><p className="eyebrow">{committee}</p><h2>{committee}</h2></div>
              </div>
              <div className="eb-poster-grid">
                {members.map((member) => (
                  <BoardPosterCard
                    key={member.id}
                    name={member.fullName}
                    committee={member.committee}
                    position={member.position}
                    image={member.photoUrl || ""}
                    bio={member.bio}
                    instagram={member.instagram}
                    linkedin={member.linkedin}
                  />
                ))}
              </div>
            </div>
          )) : null}
        </section>
        <section className="section eb-poster-section">
          <div className="section-head">
            <div><p className="eyebrow">BOARD POSTERS</p><h2>Committee leadership artwork.</h2></div>
          </div>
          <div className="eb-poster-grid">
            {localBoardPosters.map((member) => (
              <BoardPosterCard
                key={member.image}
                name={member.name}
                committee={member.committee}
                position={member.position}
                image={member.image}
              />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
