import Link from "next/link";
import { SiteFooter, SiteHeader } from "./components/SiteHeader";
import { prisma } from "../lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const testimonials = await prisma.testimonial.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    take: 6
  });

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">INVICTUS MUN 2026</p>
            <h1>Where diplomacy meets digital excellence.</h1>
            <p>
              A premium Model United Nations conference built for serious debate, thoughtful research,
              and a professional delegate experience from registration to committee room.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/registration">Register Now</Link>
              <Link className="button secondary" href="/dashboard">Check Status</Link>
              <Link className="button ghost" href="/committees">Explore Committees</Link>
            </div>
            <div className="hero-proof">
              <span><strong>500+</strong><small>Expected delegates</small></span>
              <span><strong>7</strong><small>Committees</small></span>
              <span><strong>QR</strong><small>Digital check-in</small></span>
            </div>
          </div>
          <div className="hero-panel" aria-label="Conference snapshot">
            <div className="hero-card main-card">
              <span className="live-pill">Registrations Live</span>
              <h2>Invictus MUN 2026</h2>
              <p>12-13 July 2026<br />The Grand Convention Centre</p>
              <div className="mini-grid">
                <span><small>Fee</small><strong>From INR 1,500</strong></span>
                <span><small>Deadline</small><strong>30 June 2026</strong></span>
              </div>
            </div>
            <div className="floating-card left"><small>Registration</small><strong>Now open</strong></div>
            <div className="floating-card right"><small>Allotments</small><strong>Released online</strong></div>
          </div>
        </section>

        <section className="section stats-strip" aria-label="Conference statistics">
          <article><strong>500+</strong><span>expected delegates</span></article>
          <article><strong>7</strong><span>committees</span></article>
          <article><strong>QR</strong><span>event check-in</span></article>
          <article><strong>30 June</strong><span>registration deadline</span></article>
        </section>

        <section className="section split" id="about">
          <div>
            <p className="eyebrow">ABOUT INVICTUS</p>
            <h2>A conference built like an institution.</h2>
            <p>
              Invictus MUN exists to create a serious, research-driven diplomatic environment for students,
              while giving organizers the infrastructure needed to run a modern large-scale event without
              administrative chaos.
            </p>
            <p>
              The website is the official place where participants register, explore committees,
              and check their delegate status.
            </p>
          </div>
          <div className="values-grid">
            <article><span>01</span><strong>Diplomacy</strong><p>Committee rooms designed for negotiation and principled debate.</p></article>
            <article><span>02</span><strong>Research</strong><p>Guides and structured resources for better preparation.</p></article>
            <article><span>03</span><strong>Leadership</strong><p>Purpose-built workflows for delegates, EB, Secretariat, and admins.</p></article>
            <article><span>04</span><strong>Professionalism</strong><p>Transparent allotments, verified payments, and QR-based check-in.</p></article>
          </div>
        </section>

        <section className="section" id="committees">
          <div className="section-head">
            <div><p className="eyebrow">COMMITTEES</p><h2>Debate tracks for every level of delegate.</h2></div>
            <Link href="/committees">View all committees</Link>
          </div>
          <div className="committee-grid">
            {[
              ["Advanced", "UNHRC", "Human rights protections in regions affected by conflict and displacement.", "advanced"],
              ["Intermediate", "Arab League", "Regional security, energy diplomacy, and humanitarian cooperation.", "intermediate"],
              ["Beginner", "FIFA", "Governance, hosting rights, sporting ethics, and global football policy.", "beginner"],
              ["Press", "International Press", "Journalism, photography, and editorial coverage across the conference.", "press"]
            ].map(([level, title, copy, tag]) => (
              <article className="committee-card" key={title}>
                <span className={`tag ${tag}`}>{level}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <small>Register online</small>
              </article>
            ))}
          </div>
        </section>

        <section className="section process" id="registration">
          <div className="section-head">
            <div><p className="eyebrow">REGISTRATION FLOW</p><h2>Clear for delegates. Traceable for organizers.</h2></div>
            <Link href="/registration">Start registration</Link>
          </div>
          <div className="process-grid">
            <article><span>1</span><strong>Submit details</strong><p>Personal, committee, experience, and accommodation fields.</p></article>
            <article><span>2</span><strong>Upload payment proof</strong><p>Attach your payment reference or proof for review.</p></article>
            <article><span>3</span><strong>Verification</strong><p>The organizing team reviews payment and registration details.</p></article>
            <article><span>4</span><strong>Receive allotment</strong><p>Committee, portfolio, resources, and QR pass appear on the dashboard.</p></article>
          </div>
        </section>

        <section className="section" id="eb">
          <div className="section-head"><div><p className="eyebrow">LEADERSHIP</p><h2>Executive Board and Secretariat.</h2></div><Link href="/executive-board">View Executive Board</Link></div>
          <div className="team-grid">
            <article><div className="portrait">SG</div><h3>Secretary-General</h3><p>Conference strategy and delegate experience.</p></article>
            <article><div className="portrait">DG</div><h3>Director-General</h3><p>Operations, logistics, and event-day execution.</p></article>
            <article><div className="portrait">EB</div><h3>Executive Board</h3><p>Committee moderation, guides, and debate procedure.</p></article>
            <article><div className="portrait">TO</div><h3>Technology Operations</h3><p>Registration support, delegate dashboards, and event data workflows.</p></article>
          </div>
        </section>

        <section className="section testimonials" id="testimonials">
          <div className="section-head"><div><p className="eyebrow">TESTIMONIALS</p><h2>What delegates say about Invictus.</h2></div></div>
          <div className="testimonial-grid">
            {testimonials.length ? testimonials.map((testimonial) => (
              <article className="testimonial-card" key={testimonial.id}>
                <div className="testimonial-head">
                  {testimonial.photoUrl ? <img src={testimonial.photoUrl} alt={testimonial.name} /> : <span className="portrait small">{testimonial.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>}
                  <span><strong>{testimonial.name}</strong><small>{testimonial.institution}</small></span>
                </div>
                <p>{testimonial.quote}</p>
                {testimonial.edition ? <small>{testimonial.edition}</small> : null}
              </article>
            )) : (
              <div className="empty-panel">
                <h2>Testimonials coming soon</h2>
                <p>Published delegate feedback will appear here after the organizing team adds it.</p>
              </div>
            )}
          </div>
        </section>

        <section className="section split" id="past">
          <div><p className="eyebrow">PAST CONFERENCES</p><h2>Credibility built through previous editions.</h2><p>Invictus MUN's public presence highlights delegate numbers, represented institutions, social reach, and alumni confidence from earlier conferences.</p></div>
          <div className="credibility-grid"><article><strong>30+</strong><span>institutions represented</span></article><article><strong>1.2K+</strong><span>community reach</span></article><article><strong>4.8/5</strong><span>delegate feedback</span></article><article><strong>2026</strong><span>next edition</span></article></div>
        </section>

        <section className="section resources" id="resources">
          <div><p className="eyebrow">RESOURCES</p><h2>Everything delegates need, released clearly.</h2><p>Committee information, rules of procedure, schedules, and policy documents are shared through the official website and dashboard as they are released.</p></div>
          <div className="resource-list"><Link href="/registration"><strong>Delegate Registration</strong><span>Public</span></Link><Link href="/committees"><strong>Committee Information</strong><span>Public</span></Link><Link href="/dashboard"><strong>Delegate Dashboard</strong><span>Registered delegates</span></Link></div>
        </section>

        <section className="section faq" id="faq">
          <div className="section-head"><div><p className="eyebrow">FAQS</p><h2>Common questions.</h2></div></div>
          <details open><summary>Who can register?</summary><p>Individual delegates, delegation delegates, international delegates, International Press members, EB applicants, and Secretariat members can register.</p></details>
          <details><summary>How are payments verified?</summary><p>Delegates upload a screenshot and transaction ID. The organizing team reviews the proof before approval.</p></details>
          <details><summary>When do allotments appear?</summary><p>Allotments appear after payment verification and registration approval.</p></details>
        </section>

        <section className="section policies" id="policies">
          <div className="section-head"><div><p className="eyebrow">POLICIES</p><h2>Clear rules for a professional conference.</h2></div></div>
          <div className="policy-grid">
            <article><strong>Code of Conduct</strong><p>Delegates must maintain respectful language, follow committee procedure, and comply with Secretariat instructions throughout the conference.</p></article>
            <article><strong>Refund and Payment Policy</strong><p>Registrations move forward after payment proof is verified. Refund requests are reviewed by the organizing team according to conference timelines and payment confirmation status.</p></article>
            <article><strong>Allotment Policy</strong><p>Allotments depend on committee preference, experience, eligibility, and capacity. Final decisions are released through the delegate dashboard.</p></article>
            <article><strong>Privacy Policy</strong><p>Participant records are used only for registration, verification, allotment, communication, and event operations.</p></article>
          </div>
        </section>

        <section className="section contact" id="contact">
          <div><p className="eyebrow">CONTACT</p><h2>Ready to join Invictus MUN?</h2><p>Email <a href="mailto:team@invictusmun.com">team@invictusmun.com</a> for registration, payment verification, allotment, and conference policy questions.</p></div>
          <div className="contact-actions"><Link className="button primary" href="/registration">Register Now</Link><Link className="button secondary" href="/dashboard">Check Status</Link></div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
