import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteHeader";
import { RegistrationClient } from "./RegistrationClient";

export default function RegistrationPage() {
  return (
    <>
      <SiteHeader cta="Check Status" ctaHref="/dashboard" />
      <main>
        <section className="subpage-hero cinematic-subpage registration-hero">
          <p className="eyebrow">REGISTRATION</p>
          <h1>Enter Serious Diplomacy.</h1>
          <p>Submit your delegate details, committee preferences, experience, and logistics information. Payment is completed securely through Razorpay from your dashboard.</p>
        </section>
        <section className="section registration-layout">
          <RegistrationClient />
          <aside className="registration-aside">
            <h2>What happens next?</h2>
            <ol>
              <li>Your registration is saved in the database.</li>
              <li>Your dashboard opens with the Razorpay payment button.</li>
              <li>Successful Razorpay payments are verified automatically.</li>
              <li>Admin approves your registration after payment confirmation.</li>
              <li>Committee and portfolio allotment appears on your dashboard.</li>
              <li>Your QR pass becomes available for event-day check-in.</li>
            </ol>
            <p className="empty-copy">Your data is used only for Invictus MUN registration and event operations.</p>
            <Link className="button secondary" href="/dashboard">Check registration status</Link>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
