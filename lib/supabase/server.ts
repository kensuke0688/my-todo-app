import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for server-side use (Route Handlers).
 *
 * Used only to identify the logged-in user from the request cookies.
 * Database reads/writes go through Prisma, never this client.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called outside a mutable-cookie context - the proxy handles refresh.
          }
        },
      },
    },
  );
}

/**
 * Returns the authenticated user, or null. Route Handlers use this to gate
 * access and to get the `user_id` for filtering Prisma queries.
 */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
