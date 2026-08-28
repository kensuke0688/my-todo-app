import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components ("use client").
 *
 * `createBrowserClient` stores the session in cookies (not just localStorage),
 * so the proxy (proxy.ts) can read it on the server for route protection.
 * Calling this repeatedly is cheap - the underlying client is memoized.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
