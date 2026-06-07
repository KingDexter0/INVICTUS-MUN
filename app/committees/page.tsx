import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteHeader";
import { prisma } from "../../lib/prisma";

const staticCommittees = [
  {
    level: "Advanced",
    name: "UNHRC",
    agenda: "Protecting civilians and displaced populations in active conflict zones.",
    eligibility: "Grades 10-12 and university delegates",
    portfolio: "Member states and observers",
    guide: "Background guide ready",
    tag: "advanced",
    image: "/committees/unhrc.jpg",
    registrationLink: null,
    guideLink: null,
    sortOrder: 10
  },
  {
    level: "Intermediate",
    name: "Arab League",
    agenda: "Regional security, energy policy, and humanitarian cooperation in West Asia.",
    eligibility: "School and college delegates",
    portfolio: "Member states",
    guide: "Background guide ready",
    tag: "intermediate",
    image: "/committees/arab-league.jpg",
    registrationLink: null,
    guideLink: null,
    sortOrder: 20
  },
  {
    level: "Intermediate",
    name: "UNCSW",
    agenda: "Gender equity, safety, and economic participation across developing regions.",
    eligibility: "Beginner to intermediate delegates",
    portfolio: "Countries and agencies",
    guide: "Background guide ready",
    tag: "intermediate",
    image: "/committees/uncsw.jpg",
    registrationLink: null,
    guideLink: null,
    sortOrder: 30
  },
  {
    level: "Beginner",
    name: "FIFA",
    agenda: "Reforming football governance, hosting standards, and ethical sport financing.",
    eligibility: "Open committee",
    portfolio: "Federations and stakeholders",
    guide: "Background guide ready",
    tag: "beginner",
    image: "/committees/fifa.jpg",
    registrationLink: null,
    guideLink: null,
    sortOrder: 40
  },
  {
    level: "Advanced",
    name: "UNGA Emergency Special Session",
    agenda: "Emergency multilateral response to a rapidly escalating international crisis.",
    eligibility: "Experienced delegates",
    portfolio: "UN member states",
    guide: "Background guide ready",
    tag: "advanced",
    image: "/committees/unga-ess.jpg",
    registrationLink: null,
    guideLink: null,
    sortOrder: 50
  },
  {
    level: "Beginner",
    name: "Lok Sabha",
    agenda: "Indian public policy, parliamentary debate, and coalition negotiation.",
    eligibility: "School and college delegates",
    portfolio: "MPs and parties",
    guide: "Background guide ready",
    tag: "beginner",
    image: "/committees/lok-sabha.jpg",
    registrationLink: null,
    guideLink: null,
    sortOrder: 60
  },
  {
    level: "Press",
    name: "International Press",
    agenda: "Journalism, photography, and editorial reporting across committees.",
    eligibility: "Writers, photographers, and designers",
    portfolio: "Reporter or photographer",
    guide: "Background guide ready",
    tag: "press",
    image: "/committees/international-press.jpg",
    registrationLink: null,
    guideLink: null,
    sortOrder: 70
  }
];

export default async function CommitteesPage() {
  const dbCommittees = await prisma.committee.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" }
  });

  const mappedDbCommittees = dbCommittees.map((c: any) => {
    let tag = "beginner";
    let level = "Beginner";
    if (c.difficulty.toLowerCase() === "intermediate") {
      tag = "intermediate";
      level = "Intermediate";
    } else if (c.difficulty.toLowerCase() === "advanced") {
      tag = "advanced";
      level = "Advanced";
    } else if (c.difficulty.toLowerCase() === "press") {
      tag = "press";
      level = "Press";
    } else {
      tag = c.difficulty.toLowerCase();
      level = c.difficulty;
    }

    let guide = "Background guide coming soon";
    if (c.guideStatus === "Ready") {
      guide = "Background guide ready";
    } else if (c.guideStatus === "Coming Soon") {
      guide = "Background guide coming soon";
    } else if (c.guideStatus === "Not Ready") {
      guide = "Background guide not ready";
    } else {
      guide = c.guideStatus;
    }

    return {
      level,
      name: c.name,
      agenda: c.description,
      eligibility: c.eligibility,
      portfolio: c.portfolioType,
      guide,
      tag,
      image: c.posterImageUrl,
      registrationLink: c.registrationLink,
      guideLink: c.guideLink,
      sortOrder: c.sortOrder
    };
  });

  const allCommittees = [...staticCommittees, ...mappedDbCommittees].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="subpage-hero cinematic-subpage committees-hero">
          <p className="eyebrow">COMMITTEES</p>
          <h1>Choose the room where your diplomacy sharpens.</h1>
          <p>Procedure-driven committees built around mandate, research, and defensible outcomes. MUN is not a speaking contest here; it is decision-making under scrutiny.</p>
        </section>
        <section className="section committee-directory">
          {allCommittees.map(({ level, name, agenda, eligibility, portfolio, guide, tag, image, registrationLink, guideLink }) => (
            <article className="directory-card" key={name}>
              {image ? <img className="committee-poster" src={image} alt={`${name} committee poster`} /> : null}
              <div className="badge-row">
                <span className={`tag ${tag}`}>{level.toUpperCase()}</span>
                <span className="tag neutral">{guide.toUpperCase()}</span>
              </div>
              <h2>{name}</h2>
              <p>{agenda}</p>
              <ul>
                <li>Eligibility: {eligibility}</li>
                <li>Portfolio type: {portfolio}</li>
                <li>
                  Guide status:{" "}
                  {guideLink ? (
                    <a href={guideLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--purple)" }}>
                      {guide}
                    </a>
                  ) : (
                    guide
                  )}
                </li>
              </ul>
              <Link href={registrationLink || "/registration"} target={registrationLink ? "_blank" : undefined} rel={registrationLink ? "noopener noreferrer" : undefined}>
                Register for {name}
              </Link>
            </article>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
