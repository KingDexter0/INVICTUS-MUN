import Link from "next/link";
import { SiteFooter, SiteHeader } from "./components/SiteHeader";
import { prisma } from "../lib/prisma";
import { sanitizeOptionalImageUrl } from "../lib/security";

export const dynamic = "force-dynamic";

const snapshotCards = [
  ["360+", "Delegates", "A serious multi-committee conference environment."],
  ["10", "Committees", "Decision-focused rooms across global and national mandates."],
  ["INR 2L", "Cash Prizes", "Recognition for rigor, leadership, and policy clarity."],
  ["Multi-Regional", "Participation", "Delegates and institutions across regions."]
];

const differentiators = [
  {
    number: "01",
    title: "Institution-Grade Committees",
    copy: "Committees are structured with real mandates, legal grounding, and decision consequences - not theatrics. Delegates are rewarded for precision, not volume."
  },
  {
    number: "02",
    title: "Elite Executive Board",
    copy: "Chairs are selected for authority, enforcement, and credibility - not popularity. The Board protects committee integrity with consistency."
  },
  {
    number: "03",
    title: "Serious Delegate Culture",
    copy: "Delegates are expected to prepare deeply, research responsibly, and engage with restraint. Invictus rewards defensible outcomes."
  }
];

const editionCards = [
  ["Expanded Cash Prizes", "Recognition that rewards preparation, policy rigor, and leadership - not theatrics."],
  ["International Delegations", "Broader global participation across committees, raising the standard of competition and debate."],
  ["Structured Social Spaces", "Designed networking and curated interactions - not chaos disguised as socials."]
];

const committeePreview = [
  ["UNHRC", "/committees/unhrc.jpg", "Human rights protection in conflict zones.", "Advanced", "Grades 10-12+", "Guide ready"],
  ["Arab League", "/committees/arab-league.jpg", "Regional security and energy diplomacy.", "Intermediate", "Open", "Guide ready"],
  ["UNCSW", "/committees/uncsw.jpg", "Gender equity and safety frameworks.", "Intermediate", "Open", "Guide ready"],
  ["FIFA", "/committees/fifa.jpg", "Football governance and ethical sport policy.", "Beginner", "Open", "Guide ready"],
  ["UNGA-ESS", "/committees/unga-ess.jpg", "Emergency multilateral crisis response.", "Advanced", "Experienced", "Guide ready"],
  ["Lok Sabha", "/committees/lok-sabha.jpg", "Indian parliamentary policy debate.", "Beginner", "Open", "Guide ready"],
  ["International Press", "/committees/international-press.jpg", "Editorial reporting and photography.", "Press", "Writers", "Guide ready"]
];

const ebHighlights = [
  ["Aditya Kiran", "Chairperson", "UNGA-ESS", "/local-media/executive-board/aditya-kiran.png"],
  ["Mehek Singh", "Vice-Chairperson", "UNCSW", "/local-media/executive-board/mehek-singh.png"],
  ["Paarth Veturkar", "Vice-Chairperson", "Arab League", "/local-media/executive-board/paarth-veturkar.png"],
  ["Preeti Pania", "Head of Photography", "International Press", "/local-media/executive-board/preeti-pania.png"]
];

async function getSafeTestimonials() {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 6
    });

    return testimonials.map((testimonial) => ({
      ...testimonial,
      photoUrl: sanitizeOptionalImageUrl(testimonial.photoUrl)
    }));
  } catch (error) {
    console.error("Homepage testimonials unavailable", error);
    return [];
  }
}

export default async function HomePage() {
  const safeTestimonials = await getSafeTestimonials();

  return (
    <>
      <SiteHeader />
      <main>
        <section className="cinematic-hero">
          <img className="cinematic-hero-bg" src="/local-media/gallery/background-4.jpeg" alt="" aria-hidden="true" />
          <div className="hero-scroll-cue"><span>SCROLL</span><strong>↓</strong></div>
          <div className="cinematic-hero-content">
            <span className="hero-line" />
            <p className="hero-kicker">INSTITUTION-DRIVEN · INTERNATIONAL · 2026 EDITION</p>
            <h1>Invictus Model United Nations</h1>
            <p className="hero-main-line">
              We do not simulate debate culture &mdash;<br />
              we simulate decision-making.
            </p>
            <p className="hero-support">
              Invictus Model United Nations is built to mirror the seriousness, structure, and responsibility of real diplomacy. A full-scale diplomatic conference experience built around structure, accountability, research, and institutional excellence.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/registration">Register Now</Link>
              <Link className="button secondary" href="/committees">Explore Committees</Link>
              <Link className="button ghost" href="/resources">Access Resources</Link>
              <Link className="button ghost" href="/delegate/login">Delegate Login</Link>
            </div>
          </div>
        </section>

        <section className="premium-section snapshot-section" aria-label="Conference snapshot">
          <div className="section-shell snapshot-grid">
            {snapshotCards.map(([value, label, copy]) => (
              <article className="premium-card snapshot-card reveal-card" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="premium-section light" id="about">
          <div className="section-shell">
            <div className="section-intro">
              <p className="section-kicker">CORE DIFFERENTIATORS</p>
              <h2>Why Invictus Is Different</h2>
              <p>Invictus was built to correct what modern conferences dilute - seriousness, procedural depth, and intellectual honesty.</p>
            </div>
            <div className="differentiator-grid">
              {differentiators.map((item) => (
                <article className="premium-card differentiator-card reveal-card" key={item.title}>
                  <span>{item.number}</span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="premium-section dark-feature">
          <img className="feature-bg" src="/local-media/gallery/background-6.jpeg" alt="" aria-hidden="true" />
          <div className="section-shell philosophy-layout">
            <div>
              <p className="section-kicker">INSTITUTIONAL PHILOSOPHY</p>
              <h2>Our Philosophy</h2>
              <p>Invictus does not exist to feel large. It exists to feel legitimate. The goal is not performance - it is disciplined decision-making.</p>
              <blockquote>
                "Seriousness is not aesthetics.<br />
                It is process. It is discipline.<br />
                It is accountability."
              </blockquote>
            </div>
            <div className="philosophy-stack">
              {["Structure over spectacle", "Authority over popularity", "Outcomes over optics"].map((item) => (
                <article className="glass-card" key={item}>{item}</article>
              ))}
            </div>
            <p className="philosophy-note">
              Real institutions do not reward noise. They reward clarity, restraint, and responsibility. Invictus trains delegates to think like decision-makers: to build arguments that survive scrutiny, and to propose outcomes that can be defended under pressure.
            </p>
          </div>
        </section>

        <section className="premium-section light">
          <div className="section-shell">
            <div className="section-intro">
              <p className="section-kicker">2026 EDITION</p>
              <h2>Invictus MUN 2026</h2>
              <p>The 2026 edition expands what matters - scale, quality, international reach, and recognition - while keeping the academic standard non-negotiable.</p>
            </div>
            <div className="premium-grid three">
              {editionCards.map(([title, copy]) => (
                <article className="premium-card reveal-card" key={title}>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="premium-section committee-showcase" id="committees">
          <img className="feature-bg soft" src="/local-media/gallery/background-1.jpeg" alt="" aria-hidden="true" />
          <div className="section-shell">
            <div className="section-head cinematic-head">
              <div>
                <p className="section-kicker">COMMITTEE PREVIEW</p>
                <h2>Rooms built for policy realism.</h2>
                <p>Every committee is framed around mandate, procedure, and outcome quality.</p>
              </div>
              <Link className="text-link" href="/committees">View All Committees</Link>
            </div>
            <div className="committee-preview-grid">
              {committeePreview.map(([name, image, agenda, difficulty, eligibility, guide]) => (
                <article className="committee-preview-card reveal-card" key={name}>
                  <img src={image} alt={`${name} committee poster`} />
                  <div>
                    <span className="pill">{difficulty}</span>
                    <h3>{name}</h3>
                    <p>{agenda}</p>
                    <div className="badge-row">
                      <small>{eligibility}</small>
                      <small>{guide}</small>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="premium-section light" id="eb">
          <div className="section-shell">
            <div className="section-head">
              <div>
                <p className="section-kicker">EXECUTIVE BOARD</p>
                <h2>Leadership with procedural authority.</h2>
                <p>The Board exists to protect committee integrity, enforce procedure, and raise the academic standard.</p>
              </div>
              <Link className="text-link" href="/executive-board">View Executive Board</Link>
            </div>
            <div className="eb-highlight-grid">
              {ebHighlights.map(([name, position, committee, image]) => (
                <article className="eb-highlight-card reveal-card" key={name}>
                  <img src={image} alt={name} />
                  <div>
                    <span>{committee}</span>
                    <h3>{name}</h3>
                    <p>{position}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="premium-section testimonials" id="testimonials">
          <div className="section-shell">
            <div className="section-intro">
              <p className="section-kicker">TESTIMONIALS</p>
              <h2>Proof from the conference floor.</h2>
            </div>
            <div className="testimonial-grid premium-testimonials">
              {safeTestimonials.length ? safeTestimonials.map((testimonial) => (
                <article className="testimonial-card reveal-card" key={testimonial.id}>
                  <div className="testimonial-head">
                    {testimonial.photoUrl ? <img src={testimonial.photoUrl} alt={testimonial.name} /> : <span className="portrait small">{testimonial.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>}
                    <span><strong>{testimonial.name}</strong><small>{testimonial.institution}</small></span>
                  </div>
                  <p>{testimonial.quote}</p>
                  {testimonial.edition ? <small>{testimonial.edition}</small> : null}
                </article>
              )) : (
                <article className="empty-panel premium-empty">
                  <h2>Delegate testimonials will appear here.</h2>
                  <p>The organizing team can publish testimonials from the admin portal. Until then, this space stays clean and credible.</p>
                </article>
              )}
            </div>
          </div>
        </section>

        <section className="premium-section light resources" id="resources">
          <div className="section-shell resource-cta-grid">
            <div className="resource-cta-copy">
              <p className="section-kicker">RESOURCES / STUDY GUIDES</p>
              <h2>Preparation belongs in one place.</h2>
              <p>Access background guides, Rules of Procedure, schedules, REMs, and delegate resources through the portal.</p>
            </div>
            <article className="resource-cta-card">
              <span className="resource-panel-kicker">Published Resources</span>
              <h3>Study guides, schedules, ROPs, and delegate files.</h3>
              <p>Files published from the admin portal appear in the resources area, so delegates always see the latest released material.</p>
              <div className="resource-link-grid">
                <Link className="button primary" href="/resources">View Published Resources</Link>
                <Link className="button secondary" href="/delegate/login">Delegate Login</Link>
              </div>
            </article>
          </div>
        </section>

        <section className="final-cta" id="contact">
          <div className="section-shell">
            <p className="section-kicker">ENTER SERIOUS DIPLOMACY</p>
            <h2>Registrations for Invictus Model United Nations 2026 are now open.</h2>
            <p>If you want a conference that feels legitimate - this is it.</p>
            <div className="hero-actions">
              <Link className="button primary" href="/registration">Register Now</Link>
              <Link className="button secondary" href="/resources">View Resources</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
