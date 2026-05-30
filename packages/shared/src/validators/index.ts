// ─────────────────────────────────────────────────────────────────────────────
// Field-level validators (pure functions, no runtime deps)
// Used by both mobile and admin for consistent client-side validation.
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MOBILE_RE = /^[6-9]\d{9}$/; // Indian 10-digit mobile
export const PINCODE_RE = /^\d{6}$/;       // Indian 6-digit pincode
export const PASSWORD_MIN_LENGTH = 8;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isValidMobile(mobile: string): boolean {
  return MOBILE_RE.test(mobile.trim());
}

export function isValidPincode(pincode: string): boolean {
  return PINCODE_RE.test(pincode.trim());
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

export function isValidRating(score: number): boolean {
  return Number.isInteger(score) && score >= 1 && score <= 5;
}

export function isValidPrice(price: number): boolean {
  return typeof price === "number" && price >= 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// regionKey helpers
// ─────────────────────────────────────────────────────────────────────────────
type RegionLevel = "CITY" | "STATE" | "PINCODE";

function normalise(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

/**
 * Derives a canonical region key from address fields.
 * Falls back gracefully when components are missing.
 */
export function deriveRegionKey(
  address: { country?: string; state: string; city: string; pincode: string },
  level: RegionLevel = "CITY"
): string {
  const country = normalise(address.country ?? "IN");
  const state = normalise(address.state);
  const city = normalise(address.city);
  const pincode = normalise(address.pincode);

  if (level === "PINCODE") {
    return pincode ? `${country}_${pincode}` : state ? `${country}_${state}` : "GLOBAL";
  }
  if (level === "STATE") {
    return state ? `${country}_${state}` : "GLOBAL";
  }
  // CITY (default)
  if (city && state) return `${country}_${state}_${city}`;
  if (state) return `${country}_${state}`;
  return "GLOBAL";
}
