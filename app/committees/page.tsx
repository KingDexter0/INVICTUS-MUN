import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteHeader";

const committees = [
  {
    level: "Advanced",
    name: "UNHRC",
    agenda: "Protecting civilians and displaced populations in active conflict zones.",
    eligibility: "Grades 10-12 and university delegates",
    portfolio: "Member states and observers",
    tag: "advanced",
    image: "/committees/unhrc.jpg"
  },
  {
    level: "Intermediate",
    name: "Arab League",
    agenda: "Regional security, energy policy, and humanitarian cooperation in West Asia.",
    eligibility: "School and college delegates",
    portfolio: "Member states",
    tag: "intermediate",
    image: "/committees/arab-league.jpg"
  },
  {
    level: "Intermediate",
    name: "UNCSW",
    agenda: "Gender equity, safety, and economic participation across developing regions.",
    eligibility: "Beginner to intermediate delegates",
    portfolio: "Countries and agencies",
    tag: "intermediate",
    image: "/committees/uncsw.jpg"
  },
  {
    level: "Beginner",
    name: "FIFA",
    agenda: "Reforming football governance, hosting standards, and ethical sport financing.",
    eligibility: "Open committee",
    portfolio: "Federations and stakeholders",
    tag: "beginner",
    image: "/committees/fifa.jpg"
  },
  {
    level: "Advanced",
    name: "UNGA Emergency Special Session",
    agenda: "Emergency multilateral response to a rapidly escalating international crisis.",
    eligibility: "Experienced delegates",
    portfolio: "UN member states",
    tag: "advanced",
    image: "/committees/unga-ess.jpg"
  },
  {
    level: "Beginner",
    name: "Lok Sabha",
    agenda: "Indian public policy, parliamentary debate, and coalition negotiation.",
    eligibility: "School and college delegates",
    portfolio: "MPs and parties",
    tag: "beginner",
    image: "/committees/lok-sabha.jpg"
  },
  {
    level: "Press",
    name: "International Press",
    agenda: "Journalism, photography, and editorial reporting across committees.",
    eligibility: "Writers, photographers, and designers",
    portfolio: "Reporter or photographer",
    tag: "press",
    image: null
  }
];

export default function CommitteesPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="subpage-hero">
          <p className="eyebrow">COMMITTEES</p>
          <h1>Choose the room where your diplomacy sharpens.</h1>
          <p>Every committee card includes agenda direction, difficulty, eligibility, portfolio type, and guide status.</p>
        </section>
        <section className="section committee-directory">
          {committees.map(({ level, name, agenda, eligibility, portfolio, tag, image }) => (
            <article className="directory-card" key={name}>
              {image ? <img className="committee-poster" src={image} alt={`${name} committee poster`} /> : null}
              <span className={`tag ${tag}`}>{level}</span>
              <h2>{name}</h2>
              <p>Agenda: {agenda}</p>
              <ul>
                <li>Eligibility: {eligibility}</li>
                <li>Portfolio type: {portfolio}</li>
                <li>Guide status: Coming soon</li>
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
