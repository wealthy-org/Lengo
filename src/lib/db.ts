import "server-only";
import { neon } from "@neondatabase/serverless";

/** Returns a Neon SQL client, or null when DATABASE_URL is not configured (app falls back to RPC). */
export function db() {
  const url = process.env.DATABASE_URL;
  return url ? neon(url) : null;
}
