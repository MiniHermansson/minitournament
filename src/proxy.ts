import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const sessionToken =
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/settings",
    "/admin",
    "/tournaments/new",
    "/tournaments/:path*/manage",
    "/tournaments/:path*/draft",
    "/tournaments/:path*/signup",
    "/tournaments/:path*/register",
    "/teams/new",
    "/teams/:path*/manage",
  ],
};
