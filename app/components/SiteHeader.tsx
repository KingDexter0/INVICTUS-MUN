"use client";

import Link from "next/link";
import { useState } from "react";

export function SiteHeader({ cta = "DELEGATE LOGIN", ctaHref = "/delegate/login" }: { cta?: string; ctaHref?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Invictus MUN home">
        <span className="brand-mark logo-mark"><img src="/invictus-logo.jpg" alt="" /></span>
        <span>
          <strong>INVICTUS</strong>
          <small>MODEL UNITED NATIONS</small>
        </span>
      </Link>
      <button className="menu-toggle" aria-label="Open navigation" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        Menu
      </button>
      <nav className={isOpen ? "site-nav open" : "site-nav"} aria-label="Primary navigation" onClick={() => setIsOpen(false)}>
        <Link href="/">HOME</Link>
        <Link href="/committees">COMMITTEES</Link>
        <Link href="/executive-board">EXECUTIVE BOARD</Link>
        <Link href="/registration">REGISTRATION</Link>
        <Link href="/resources">RESOURCES</Link>
        <Link href="/contact">CONTACT</Link>
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
        <p>Excellence / Diplomacy / Institutional Integrity</p>
      </div>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/committees">Committees</Link>
        <Link href="/executive-board">Executive Board</Link>
        <Link href="/registration">Registration</Link>
        <Link href="/resources">Resources</Link>
        <Link href="/delegate/login">Delegate Login</Link>
        <Link href="/#policies">Policies</Link>
        <Link href="/contact">Contact</Link>
      </nav>
      <p className="footer-copy">© 2026 Invictus Model United Nations</p>
    </footer>
  );
}
