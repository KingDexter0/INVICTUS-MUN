/**
 * lib/url.ts — Centralized URL builder for Invictus MUN email links.
 *
 * Priority order for base URL:
 *   1. APP_URL (explicit production override, recommended)
 *   2. NEXT_PUBLIC_APP_URL (public env var for client use)
 *   3. VERCEL_PROJECT_PRODUCTION_URL (Vercel auto-injects this)
 *   4. VERCEL_URL (Vercel preview/branch URL, auto-injected)
 *   5. x-forwarded-proto + host headers from the incoming request
 *
 * If none of the above resolve, an error is thrown so misconfigured
 * deployments are caught loudly rather than silently sending localhost links.
 */

export function getBaseUrl(req?: Request): string {
  const envUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    // Vercel auto-injects VERCEL_URL and VERCEL_PROJECT_PRODUCTION_URL without a scheme.
    const withScheme = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
    return withScheme.replace(/\/$/, "");
  }

  if (req) {
    const host = req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  }

  throw new Error(
    "APP_URL is not configured. Set APP_URL=https://your-domain.com in Vercel Environment Variables before sending emails."
  );
}

/**
 * Validates that a URL does not point to localhost, which would produce
 * broken links in production emails.
 */
function assertNotLocalhost(url: string, context: string) {
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    throw new Error(
      `[email] Refusing to send ${context} with a localhost URL: "${url}". ` +
      `Set APP_URL=https://your-production-domain.com in Vercel Environment Variables.`
    );
  }
}

/**
 * Returns the absolute delegate status/dashboard URL for use in emails.
 * Navigates to /dashboard?id=<trackingToken> which is the public status page.
 *
 * ⚠ Always pass the INDIVIDUAL delegate's own trackingToken.
 * Never pass a parent DelegationRegistration ID.
 */
export function getDelegateDashboardUrl(trackingToken: string, req?: Request): string {
  if (!trackingToken) {
    throw new Error("trackingToken is required to build a delegate dashboard URL");
  }
  const baseUrl = getBaseUrl(req);
  const url = `${baseUrl}/dashboard?id=${encodeURIComponent(trackingToken)}`;
  assertNotLocalhost(url, "delegate dashboard link");
  return url;
}

/**
 * Returns the absolute QR pass verification URL.
 */
export function getVerifyPassUrl(trackingToken: string, req?: Request): string {
  const baseUrl = getBaseUrl(req);
  const url = `${baseUrl}/verify/pass/${encodeURIComponent(trackingToken)}`;
  assertNotLocalhost(url, "verify pass link");
  return url;
}

/**
 * Returns the absolute certificate view URL for the certificates page.
 * Uses /certificates/<certificateNo> which is the project's existing route.
 */
export function getCertificateUrl(certificateNo: string, req?: Request): string {
  const baseUrl = getBaseUrl(req);
  const url = `${baseUrl}/certificates/${encodeURIComponent(certificateNo)}`;
  assertNotLocalhost(url, "certificate link");
  return url;
}

/**
 * Converts a relative certificate path or full URL into an absolute URL.
 * If the input is already an absolute http(s) URL it is returned unchanged
 * (after a localhost check).
 */
export function getCertificateDownloadUrl(certificateUrlOrPath: string, req?: Request): string {
  if (!certificateUrlOrPath) {
    throw new Error("certificateUrlOrPath is required");
  }
  if (certificateUrlOrPath.startsWith("http://") || certificateUrlOrPath.startsWith("https://")) {
    assertNotLocalhost(certificateUrlOrPath, "certificate download link");
    return certificateUrlOrPath;
  }
  const baseUrl = getBaseUrl(req);
  const path = certificateUrlOrPath.startsWith("/") ? certificateUrlOrPath : `/${certificateUrlOrPath}`;
  const url = `${baseUrl}${path}`;
  assertNotLocalhost(url, "certificate download link");
  return url;
}
