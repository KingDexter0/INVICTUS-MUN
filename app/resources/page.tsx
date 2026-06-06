import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteHeader";
import { prisma } from "../../lib/prisma";
import { isSafeExternalUrl } from "../../lib/security";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value);
}

export default async function ResourcesPage() {
  const resources = await prisma.resource.findMany({
    orderBy: [{ category: "asc" }, { createdAt: "desc" }]
  });

  const safeResources = resources
    .filter((resource) => isSafeExternalUrl(resource.fileUrl))
    .map((resource) => ({
      ...resource,
      description: resource.description || "Published delegate resource for Invictus MUN preparation."
    }));

  const groupedResources = safeResources.reduce<Record<string, typeof safeResources>>((groups, resource) => {
    const category = resource.category || "General";
    groups[category] = groups[category] || [];
    groups[category].push(resource);
    return groups;
  }, {});

  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero resource-page-hero">
          <div className="section-shell">
            <p className="section-kicker">PUBLISHED RESOURCES</p>
            <h1>Study Guides & Delegate Resources</h1>
            <p>
              Access the files released by the Invictus MUN organizing team. Background guides,
              schedules, ROPs, REMs, and preparation material will appear here as they are published.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/registration">Register Now</Link>
              <Link className="button secondary" href="/delegate/login">Delegate Login</Link>
            </div>
          </div>
        </section>

        <section className="premium-section light public-resources-section">
          <div className="section-shell">
            {safeResources.length ? (
              <div className="public-resource-groups">
                {Object.entries(groupedResources).map(([category, items]) => (
                  <section className="public-resource-group" key={category}>
                    <div className="section-head compact">
                      <div>
                        <p className="section-kicker">{category}</p>
                        <h2>{category} Files</h2>
                      </div>
                      <span className="resource-count">{items.length} published</span>
                    </div>
                    <div className="public-resource-grid">
                      {items.map((resource) => (
                        <article className="public-resource-card reveal-card" key={resource.id}>
                          <div>
                            <span className="pill">{resource.accessLevel}</span>
                            <h3>{resource.title}</h3>
                            <p>{resource.description}</p>
                          </div>
                          <div className="public-resource-meta">
                            <span>Published {formatDate(resource.createdAt)}</span>
                            <a className="button primary small" href={`/api/resources/${resource.id}/download`}>
                              Download Resource
                            </a>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <article className="empty-panel premium-empty public-resource-empty">
                <p className="section-kicker">COMING SOON</p>
                <h2>No public resources have been published yet.</h2>
                <p>
                  Once the organizing team uploads study guides or schedules from the admin portal,
                  they will appear here without requiring a delegate login.
                </p>
                <Link className="button primary" href="/registration">Register for Updates</Link>
              </article>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
