/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CENTRAL PROJECT CONFIG
 * Change LOCAL or PROD values here and the entire project picks them up.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HOW TO USE:
 *   - Set USE_PROD = false  →  local dev (Docker API + local Mongo)
 *   - Set USE_PROD = true   →  production (Render API + Atlas Mongo)
 *
 * Mobile app reads:  EXPO_PUBLIC_API_BASE_URL  (set in apps/mobile/.env)
 * Admin app reads:   API_BASE_URL              (set in apps/admin/.env.local)
 * API reads:         MONGODB_URI, JWT_*, etc.  (set in services/api/.env  OR  Render env vars)
 */

// ─── TOGGLE: flip this to switch between local and production ─────────────────
export const USE_PROD = true;

// ─── API Endpoints ────────────────────────────────────────────────────────────
export const API = {
  LOCAL:  "http://localhost:8000/api/v1",
  PROD:   "https://scjym-api.onrender.com/api/v1",
} as const;

export const API_BASE_URL = USE_PROD ? API.PROD : API.LOCAL;

// ─── Cloudinary ───────────────────────────────────────────────────────────────
export const CLOUDINARY = {
  CLOUD_NAME: "REPLACE_CLOUDINARY_CLOUD_NAME",
  API_KEY:    "REPLACE_CLOUDINARY_API_KEY",
  // NOTE: never expose API_SECRET in frontend code — keep it in .env / Render only
} as const;

// ─── FCM (Firebase Cloud Messaging) ──────────────────────────────────────────
export const FCM = {
  SERVER_KEY: "REPLACE_FCM_SERVER_KEY",
  // Add your google-services.json / GoogleService-Info.plist values here
  PROJECT_ID: "REPLACE_FIREBASE_PROJECT_ID",
} as const;

// ─── App Info ─────────────────────────────────────────────────────────────────
export const APP = {
  NAME:              "SCJYM",
  DEEP_LINK_SCHEME:  "scjygm",
  SUPPORT_EMAIL:     "support@scjygm.com",
} as const;

// ─── MongoDB (used only in services/api — do NOT import in frontend) ──────────
// Keep actual credentials in services/api/.env or Render environment variables.
// This is just documentation of the key names.
export const MONGO_ENV_KEYS = {
  URI_KEY: "MONGODB_URI",   // e.g. mongodb+srv://user:pass@cluster/scjygm
} as const;
