import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteHeader";

const committees = [
  {
    level: "Advanced",
    name: "UNHRC",
    agenda: "Protecting civilians and displaced populations in active conflict zones.",
    eligibility: "Grades 10-12 and university delegates",
    portfolio: "Member states and observers",
    guide: "Background guide ready",
    tag: "advanced",
    image: "/committees/unhrc.jpg"
  },
  {
    level: "Intermediate",
    name: "Arab League",
    agenda: "Regional security, energy policy, and humanitarian cooperation in West Asia.",
    eligibility: "School and college delegates",
    portfolio: "Member states",
    guide: "Background guide ready",
    tag: "intermediate",
    image: "/committees/arab-league.jpg"
  },
  {
    level: "Intermediate",
    name: "UNCSW",
    agenda: "Gender equity, safety, and economic participation across developing regions.",
    eligibility: "Beginner to intermediate delegates",
    portfolio: "Countries and agencies",
    guide: "Background guide ready",
    tag: "intermediate",
    image: "/committees/uncsw.jpg"
  },
  {
    level: "Beginner",
    name: "FIFA",
    agenda: "Reforming football governance, hosting standards, and ethical sport financing.",
    eligibility: "Open committee",
    portfolio: "Federations and stakeholders",
    guide: "Background guide ready",
    tag: "beginner",
    image: "/committees/fifa.jpg"
  },
  {
    level: "Advanced",
    name: "UNGA Emergency Special Session",
    agenda: "Emergency multilateral response to a rapidly escalating international crisis.",
    eligibility: "Experienced delegates",
    portfolio: "UN member states",
    guide: "Background guide ready",
    tag: "advanced",
    image: "/committees/unga-ess.jpg"
  },
  {
    level: "Beginner",
    name: "Lok Sabha",
    agenda: "Indian public policy, parliamentary debate, and coalition negotiation.",
    eligibility: "School and college delegates",
    portfolio: "MPs and parties",
    guide: "Background guide ready",
    tag: "beginner",
    image: "/committees/lok-sabha.jpg"
  },
  {
    level: "Press",
    name: "International Press",
    agenda: "Journalism, photography, and editorial reporting across committees.",
    eligibility: "Writers, photographers, and designers",
    portfolio: "Reporter or photographer",
    guide: "Background guide ready",
    tag: "press",
    image: "/committees/international-press.jpg"
  }
];

export default function CommitteesPage() {
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
          {committees.map(({ level, name, agenda, eligibility, portfolio, guide, tag, image }) => (
            <article className="directory-card" key={name}>
              {image ? <img className="committee-poster" src={image} alt={`${name} committee poster`} /> : null}
              <div className="badge-row">
                <span className={`tag ${tag}`}>{level}</span>
                <span className="tag neutral">{guide}</span>
              </div>
              <h2>{name}</h2>
              <p>{agenda}</p>
              <ul>
                <li>Eligibility: {eligibility}</li>
                <li>Portfolio type: {portfolio}</li>
                <li>Guide status: Released through delegate resources</li>
              </ul>
              <Link href="/registration">Register for {name}</Link>
            </article>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
