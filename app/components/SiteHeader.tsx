import Link from "next/link";

export function SiteHeader({ cta = "Register Now", ctaHref = "/registration" }: { cta?: string; ctaHref?: string }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Invictus MUN home">
        <span className="brand-mark logo-mark"><img src="/invictus-logo.jpg" alt="" /></span>
        <span>
          <strong>INVICTUS</strong>
          <small>MODEL UNITED NATIONS</small>
        </span>
      </Link>
      <button className="menu-toggle" aria-label="Open navigation" aria-expanded="false">
        Menu
      </button>
      <nav className="site-nav" aria-label="Primary navigation">
        <Link href="/#about">About</Link>
        <Link href="/committees">Committees</Link>
        <Link href="/#past">Past Conferences</Link>
        <Link href="/executive-board">Executive Board</Link>
        <Link href="/#resources">Resources</Link>
        <Link href="/dashboard">Check Status</Link>
        <Link href="/#faq">FAQs</Link>
      </nav>
      <Link className="nav-cta" href={ctaHref}>
        {cta}
      </Link>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Link className="brand" href="/">
          <span className="brand-mark logo-mark"><img src="/invictus-logo.jpg" alt="" /></span>
          <span>
            <strong>INVICTUS</strong>
            <small>MODEL UNITED NATIONS</small>
          </span>
        </Link>
        <p>invictusmun.com</p>
      </div>
      <nav>
        <Link href="/#about">About</Link>
        <Link href="/committees">Committees</Link>
        <Link href="/executive-board">Executive Board</Link>
        <Link href="/registration">Registration</Link>
        <Link href="/dashboard">Status</Link>
        <Link href="/#policies">Policies</Link>
      </nav>
    </footer>
  );
}
