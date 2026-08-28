import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request and enforces auth-based routing.
 *
 * This is the Supabase "middleware" helper. In Next.js 16 the `middleware.ts`
 * file convention was renamed to `proxy.ts`, so the root entry point lives in
 * `proxy.ts` and delegates here.
 *
 * Routing rules:
 * - not logged in + protected route  -> redirect to /login
 * - logged in + /login or /signup    -> redirect to /
 * - /api/* is never redirected (route handlers do their own auth checks)
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() must run right after creating the client so the auth
  // token is validated/refreshed before any redirect decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isApiRoute = pathname.startsWith("/api");

  if (!user && !isAuthRoute && !isApiRoute) {
    return redirectTo(request, "/login", supabaseResponse);
  }

  if (user && isAuthRoute) {
    return redirectTo(request, "/", supabaseResponse);
  }

  // Must return supabaseResponse as-is so refreshed auth cookies reach the browser.
  return supabaseResponse;
}

/** Redirect while carrying over any auth cookies set during session refresh. */
function redirectTo(
  request: NextRequest,
  pathname: string,
  from: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const response = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}
