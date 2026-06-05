import { SiteFooter, SiteHeader } from "../../components/SiteHeader";
import { LoginClient } from "./LoginClient";

export default function EbLoginPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="subpage-hero cinematic-subpage eb-login-hero">
          <p className="eyebrow">EB LOGIN</p>
          <h1>Executive Board workspace.</h1>
          <p>EB members can verify using the email and phone saved in their EB profile. This workspace stays separate from admin operations.</p>
        </section>
        <section className="section registration-layout">
          <LoginClient />
          <aside className="registration-aside"><h2>Limited workspace</h2><p className="empty-copy">This does not open the admin portal. It only shows the EB member profile and committee assignment.</p></aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
