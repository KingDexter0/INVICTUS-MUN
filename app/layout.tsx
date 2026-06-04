import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../site.css";
import "../portal.css";

export const metadata: Metadata = {
  title: "Invictus MUN",
  description: "Invictus MUN public website for registration, committees, resources, and delegate status"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
