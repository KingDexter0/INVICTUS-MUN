import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteHeader";

const committees = [
  ["Advanced", "UNHRC", "Protecting civilians and displaced populations in active conflict zones.", "Grades 10-12 and university delegates", "Member states and observers", "advanced"],
  ["Intermediate", "Arab League", "Regional security, energy policy, and humanitarian cooperation in West Asia.", "School and college delegates", "Member states", "intermediate"],
  ["Intermediate", "UNCSW", "Gender equity, safety, and economic participation across developing regions.", "Beginner to intermediate delegates", "Countries and agencies", "intermediate"],
  ["Beginner", "FIFA", "Reforming football governance, hosting standards, and ethical sport financing.", "Open committee", "Federations and stakeholders", "beginner"],
  ["Advanced", "UNGA Emergency Special Session", "Emergency multilateral response to a rapidly escalating international crisis.", "Experienced delegates", "UN member states", "advanced"],
  ["Beginner", "Lok Sabha", "Indian public policy, parliamentary debate, and coalition negotiation.", "School and college delegates", "MPs and parties", "beginner"],
  ["Press", "International Press", "Journalism, photography, and editorial reporting across committees.", "Writers, photographers, and designers", "Reporter or photographer", "press"]
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
          {committees.map(([level, name, agenda, eligibility, portfolio, tag]) => (
            <article className="directory-card" key={name}>
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
