import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { AUTH_CONFIG } from "@/lib/constants";
import { isRememberLoginActive, REMEMBER_LOGIN_COOKIE } from "@/lib/auth-remember";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
    const { supabase, supabaseResponse } = createMiddlewareClient(request);
    const pathname = request.nextUrl.pathname;

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake can make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const rememberedLogin = request.cookies.get(REMEMBER_LOGIN_COOKIE)?.value;
    if (pathname === "/") {
        const url = request.nextUrl.clone();
        url.pathname =
            user && isRememberLoginActive(rememberedLogin, user.id)
                ? AUTH_CONFIG.rememberedLoginPath
                : user
                    ? AUTH_CONFIG.afterLoginPath
                    : AUTH_CONFIG.authPath;
        return NextResponse.redirect(url);
    }

    const isLoginEntryPath =
        pathname === AUTH_CONFIG.authPath ||
        pathname === AUTH_CONFIG.loginPath;

    if (user && isLoginEntryPath && isRememberLoginActive(rememberedLogin, user.id)) {
        const url = request.nextUrl.clone();
        url.pathname = AUTH_CONFIG.rememberedLoginPath;
        return NextResponse.redirect(url);
    }

    if (
        !user &&
        pathname !== "/" &&
        !pathname.startsWith(AUTH_CONFIG.authPath) &&
        !pathname.startsWith(AUTH_CONFIG.loginPath) &&
        !pathname.startsWith(AUTH_CONFIG.signupPath) &&
        !pathname.startsWith("/forgot-password")
    ) {
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone();
        url.pathname = AUTH_CONFIG.authPath;
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - api (webhooks and API routes)
         * - favicon.ico (favicon file)
         * - sw.js and manifest.json (PWA assets)
         * Feel free to modify this pattern to include more paths.
         */
        "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};
