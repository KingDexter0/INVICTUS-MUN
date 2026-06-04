import { Suspense } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  return (
    <>
      <SiteHeader cta="Register Now" ctaHref="/registration" />
      <main>
        <section className="subpage-hero dashboard-hero">
          <p className="eyebrow">DELEGATE DASHBOARD</p>
          <h1>Welcome to your portal.</h1>
          <p>Your registration, payment, allotment, resources, and QR pass status appear here.</p>
        </section>
        <Suspense>
          <DashboardClient />
        </Suspense>
      </main>
    </>
  );
}
