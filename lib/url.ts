export function getBaseUrl(req?: Request) {
  const envUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  if (req) {
    const host = req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  }

  return "";
}

export function getDelegateDashboardUrl(trackingToken: string, req?: Request) {
  const baseUrl = getBaseUrl(req);
  return `${baseUrl}/dashboard?id=${encodeURIComponent(trackingToken)}`;
}

export function getVerifyPassUrl(trackingToken: string, req?: Request) {
  const baseUrl = getBaseUrl(req);
  return `${baseUrl}/verify/pass/${encodeURIComponent(trackingToken)}`;
}

export function getCertificateUrl(certificateNo: string, req?: Request) {
  const baseUrl = getBaseUrl(req);
  return `${baseUrl}/certificates/${encodeURIComponent(certificateNo)}`;
}
