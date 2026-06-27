// Application
if (!process.env.NODE_ENV)
  throw new Error("NODE_ENV environment variable not set");
if (!process.env.PORT) throw new Error("PORT environment variable not set");
if (!process.env.FRONTEND_URL)
  throw new Error("FRONTEND_URL environment variable not set");

if (!process.env.CORS_ORIGINS)
  throw new Error("CORS_ORIGINS environment variable not set");

// Database
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL environment variable not set");

// Redis
if (!process.env.REDIS_URL)
  throw new Error("REDIS_URL environment variable not set");

// Clerk
if (!process.env.CLERK_SECRET_KEY)
  throw new Error("CLERK_SECRET_KEY environment variable not set");
if (!process.env.CLERK_WEBHOOK_SECRET)
  throw new Error("CLERK_WEBHOOK_SECRET environment variable not set");

// NotchPay
if (!process.env.NOTCHPAY_PUBLIC_KEY)
  throw new Error("NOTCHPAY_PUBLIC_KEY environment variable not set");
if (!process.env.NOTCHPAY_SECRET_KEY)
  throw new Error("NOTCHPAY_SECRET_KEY environment variable not set");
if (!process.env.NOTCHPAY_WEBHOOK_SECRET)
  throw new Error("NOTCHPAY_WEBHOOK_SECRET environment variable not set");

// LiveKit
if (!process.env.LIVEKIT_URL)
  throw new Error("LIVEKIT_URL environment variable not set");
if (!process.env.LIVEKIT_API_KEY)
  throw new Error("LIVEKIT_API_KEY environment variable not set");
if (!process.env.LIVEKIT_API_ECRET)
  throw new Error("LIVEKIT_API_SECRET environment variable not set");

// Interserver Storage
if (!process.env.STORAGE_ENDPOINT)
  throw new Error("STORAGE_ENDPOINT environment variable not set");
if (!process.env.STORAGE_ACCESS_KEY)
  throw new Error("STORAGE_ACCESS_KEY environment variable not set");
if (!process.env.STORAGE_SECRET_KEY)
  throw new Error("STORAGE_SECRET_KEY environment variable not set");
if (!process.env.STORAGE_BUCKET)
  throw new Error("STORAGE_BUCKET environment variable not set");

// Cloudflare CDN
if (!process.env.CDN_BASE_URL)
  throw new Error("CDN_BASE_URL environment variable not set");

// Resend
if (!process.env.RESEND_API_KEY)
  throw new Error("RESEND_API_KEY environment variable not set");

// Firebase
if (!process.env.FIREBASE_PROJECT_ID)
  throw new Error("FIREBASE_PROJECT_ID environment variable not set");
if (!process.env.FIREBASE_CLIENT_EMAIL)
  throw new Error("FIREBASE_CLIENT_EMAIL environment variable not set");
if (!process.env.FIREBASE_PRIVATE_KEY)
  throw new Error("FIREBASE_PRIVATE_KEY environment variable not set");

// WhatsApp
if (!process.env.WHATSAPP_ACCESS_TOKEN)
  throw new Error("WHATSAPP_ACCESS_TOKEN environment variable not set");
if (!process.env.WHATSAPP_PHONE_NUMBER_ID)
  throw new Error("WHATSAPP_PHONE_NUMBER_ID environment variable not set");
if (!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)
  throw new Error("WHATSAPP_WEBHOOK_VERIFY_TOKEN environment variable not set");

// Flagsmith
if (!process.env.FLAGSMITH_ENVIRONMENT_KEY)
  throw new Error("FLAGSMITH_ENVIRONMENT_KEY environment variable not set");
if (!process.env.FLAGSMITH_API_URL)
  throw new Error("FLAGSMITH_API_URL environment variable not set");

// PostHog
if (!process.env.POSTHOG_API_KEY)
  throw new Error("POSTHOG_API_KEY environment variable not set");
if (!process.env.POSTHOG_HOST)
  throw new Error("POSTHOG_HOST environment variable not set");

// Sentry
if (!process.env.SENTRY_DSN)
  throw new Error("SENTRY_DSN environment variable not set");

// Docs
if (!process.env.DOCS_USERNAME)
  throw new Error("DOCS_USERNAME environment variable not set");
if (!process.env.DOCS_PASSWORD)
  throw new Error("DOCS_PASSWORD environment variable not set");

// Wallet
if (!process.env.WALLET_MIN_TOPUP)
  throw new Error("WALLET_MIN_TOPUP environment variable not set");

// Socket.io
if (!process.env.SOCKET_IO_CORS_ORIGIN)
  throw new Error("SOCKET_IO_CORS_ORIGIN environment variable not set");

// Pagination
if (!process.env.DEFAULT_PAGE_SIZE)
  throw new Error("DEFAULT_PAGE_SIZE environment variable not set");
if (!process.env.MAX_PAGE_SIZE)
  throw new Error("MAX_PAGE_SIZE environment variable not set");

if (!process.env.CLERK_PUBLISHABLE_KEY)
  throw new Error("CLERK_PUBLISHABLE_KEY environment variable not set");

if (!process.env.CLERK_SECRET_KEY)
  throw new Error("CLERK_SECRET_KEY environment variable not set");

if (!process.env.PERMISSION_CACHE_TTL_SECONDS)
  throw new Error("PERMISSION_CACHE_TTL_SECONDS environment variable not set");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET enviroment variable not set");
}

if (!process.env.JWT_EXPIRES_IN) {
  throw new Error("JWT_EXPIRES_IN enviroment variable not set");
}
// =============================================
// Typed exports — use these throughout the app
// never use process.env directly outside this file
// =============================================

export const NODE_ENV = process.env.NODE_ENV as
  | "development"
  | "production"
  | "test";
export const PORT = Number(process.env.PORT);
export const FRONTEND_URL = process.env.FRONTEND_URL!;

export const DATABASE_URL = process.env.DATABASE_URL!;
export const REDIS_URL = process.env.REDIS_URL!;

export const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY!;
export const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

export const NOTCHPAY_PUBLIC_KEY = process.env.NOTCHPAY_PUBLIC_KEY!;
export const NOTCHPAY_SECRET_KEY = process.env.NOTCHPAY_SECRET_KEY!;
export const NOTCHPAY_WEBHOOK_SECRET = process.env.NOTCHPAY_WEBHOOK_SECRET!;

export const LIVEKIT_URL = process.env.LIVEKIT_URL!;
export const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
export const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;

export const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT!;
export const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY!;
export const STORAGE_SECRET_KEY = process.env.STORAGE_SECRET_KEY!;
export const STORAGE_BUCKET = process.env.STORAGE_BUCKET!;
export const STORAGE_REGION = process.env.STORAGE_REGION || "us-east-1";

export const CDN_BASE_URL = process.env.CDN_BASE_URL!;
export const RESEND_API_KEY = process.env.RESEND_API_KEY!;

export const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID!;
export const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL!;
export const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY!;

export const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
export const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
export const WHATSAPP_WEBHOOK_VERIFY_TOKEN =
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!;

export const FLAGSMITH_ENVIRONMENT_KEY = process.env.FLAGSMITH_ENVIRONMENT_KEY!;
export const FLAGSMITH_API_URL = process.env.FLAGSMITH_API_URL!;

export const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY!;
export const POSTHOG_HOST = process.env.POSTHOG_HOST!;

export const SENTRY_DSN = process.env.SENTRY_DSN!;

export const DOCS_USERNAME = process.env.DOCS_USERNAME!;
export const DOCS_PASSWORD = process.env.DOCS_PASSWORD!;

export const WALLET_MIN_TOPUP = Number(process.env.WALLET_MIN_TOPUP);
export const SOCKET_IO_CORS_ORIGIN = process.env.SOCKET_IO_CORS_ORIGIN!;
export const DEFAULT_PAGE_SIZE = Number(process.env.DEFAULT_PAGE_SIZE);
export const MAX_PAGE_SIZE = Number(process.env.MAX_PAGE_SIZE);
export const CORS_ORIGINS = process.env.CORS_ORIGINS;
export const PERMISSION_CACHE_TTL_SECONDS =
  process.env.PERMISSION_CACHE_TTL_SECONDS;
export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
