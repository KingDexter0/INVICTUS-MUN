import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "../components/SiteHeader";
import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  return (
    <>
      <SiteHeader cta="Register Now" ctaHref="/registration" />
      <main>
        <section className="subpage-hero cinematic-subpage dashboard-hero">
          <p className="eyebrow">DELEGATE DASHBOARD</p>
          <h1>Track every official step.</h1>
          <p>Your registration, payment, approval, allotment, resources, and QR pass status appear here with a clear event-ready timeline.</p>
        </section>
        <Suspense>
          <DashboardClient />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
