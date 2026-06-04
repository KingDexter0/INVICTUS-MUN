import Link from "next/link";
import { SiteFooter, SiteHeader } from "../../components/SiteHeader";
import { LoginClient } from "./LoginClient";

export default function DelegateLoginPage() {
  return (
    <>
      <SiteHeader cta="Register Now" ctaHref="/registration" />
      <main>
        <section className="subpage-hero dashboard-hero">
          <p className="eyebrow">DELEGATE LOGIN</p>
          <h1>Open your private delegate dashboard.</h1>
          <p>Verify with the same email and phone number used during registration.</p>
        </section>
        <section className="section registration-layout">
          <LoginClient />
          <aside className="registration-aside">
            <h2>Need the fallback?</h2>
            <p className="empty-copy">The public status lookup still works if you only want to check by registration ID, email, or phone.</p>
            <Link className="button secondary" href="/dashboard">Use public status lookup</Link>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

