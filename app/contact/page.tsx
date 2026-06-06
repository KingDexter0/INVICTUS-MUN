import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteHeader";

export const metadata = {
  title: "Contact | Invictus Model United Nations 2026",
  description:
    "Get in touch with the Invictus MUN 2026 organizing team. Reach our Delegate Affairs Team for any questions about registration, allotment, or resources."
};

const delegateAffairsContacts = [
  {
    name: "Dhwani Nair",
    role: "Delegate Affairs Team",
    phone: "+91 96654 65608",
    tel: "tel:+919665465608"
  },
  {
    name: "Om Lanjewar",
    role: "Delegate Affairs Team",
    phone: "+91 94217 89804",
    tel: "tel:+919421789804"
  },
  {
    name: "General Enquiries",
    role: "Invictus MUN Support",
    phone: "+91 83800 97078",
    tel: "tel:+918380097078"
  }
];

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero resource-page-hero">
          <div className="section-shell">
            <p className="section-kicker">GET IN TOUCH</p>
            <h1>Contact Invictus MUN</h1>
            <p>
              Reach the organizing team for questions about registration, allotment,
              resources, or any other conference-related enquiries.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/registration">
                Register Now
              </Link>
              <Link className="button secondary" href="/resources">
                View Resources
              </Link>
            </div>
          </div>
        </section>

        <section className="premium-section light">
          <div className="section-shell">
            <div className="section-intro">
              <p className="section-kicker">DELEGATE AFFAIRS TEAM</p>
              <h2>Speak to the right person.</h2>
              <p>
                Our Delegate Affairs Team handles all delegate-facing queries — from
                registration questions to allotment clarifications and resource access.
              </p>
            </div>

            <div className="contact-card-grid">
              {delegateAffairsContacts.map((contact) => (
                <article className="contact-card premium-card reveal-card" key={contact.tel}>
                  <div className="contact-card-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 5.61 5.61l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <div className="contact-card-body">
                    <span className="contact-card-role">{contact.role}</span>
                    <h3 className="contact-card-name">{contact.name}</h3>
                    <a
                      className="contact-card-phone"
                      href={contact.tel}
                      aria-label={`Call ${contact.name} at ${contact.phone}`}
                    >
                      {contact.phone}
                    </a>
                  </div>
                  <a
                    className="button primary small contact-call-btn"
                    href={contact.tel}
                    aria-label={`Call ${contact.name}`}
                  >
                    Call Now
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="premium-section" id="contact-note">
          <div className="section-shell">
            <article className="contact-note-card premium-card">
              <div>
                <p className="section-kicker">RESPONSE TIME</p>
                <h2>We respond within 24 hours.</h2>
                <p>
                  For fastest resolution, call during 10 AM – 7 PM IST on weekdays.
                  All delegate registration and allotment queries are handled by the
                  Delegate Affairs Team listed above.
                </p>
              </div>
              <div className="contact-note-actions">
                <Link className="button primary" href="/registration">
                  Start Registration
                </Link>
                <Link className="button secondary" href="/resources">
                  Access Resources
                </Link>
                <Link className="button ghost" href="/delegate/login">
                  Delegate Login
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
