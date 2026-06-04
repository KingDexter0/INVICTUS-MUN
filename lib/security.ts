const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

export function safeText(value: unknown, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

export function sanitizeOptionalImageUrl(value: unknown) {
  const raw = safeText(value, 1000);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return null;

    const pathname = url.pathname.toLowerCase();
    const isCloudinaryImage =
      url.hostname.endsWith("cloudinary.com") && pathname.includes("/image/upload/");
    const hasImageExtension = imageExtensions.some((extension) => pathname.endsWith(extension));

    if (!isCloudinaryImage && !hasImageExtension) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function requireOptionalImageUrl(value: unknown, label = "Image URL") {
  const raw = safeText(value, 1000);
  if (!raw) return null;

  const sanitized = sanitizeOptionalImageUrl(raw);
  if (!sanitized) {
    throw new Error(`${label} must be a valid http(s) image URL ending in jpg, jpeg, png, webp, gif, or avif.`);
  }
  return sanitized;
}

export function sanitizeOptionalSocialUrl(value: unknown, allowedHosts: string[]) {
  const raw = safeText(value, 1000);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!allowedHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function requireOptionalSocialUrl(value: unknown, allowedHosts: string[], label: string) {
  const raw = safeText(value, 1000);
  if (!raw) return null;

  const sanitized = sanitizeOptionalSocialUrl(raw, allowedHosts);
  if (!sanitized) {
    throw new Error(`${label} must be a valid ${allowedHosts.join(" or ")} URL.`);
  }
  return sanitized;
}

export function isSafeExternalUrl(value: unknown) {
  const raw = safeText(value, 1000);
  if (!raw) return false;

  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
}
