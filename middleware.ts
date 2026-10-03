import { NextResponse } from "next/server";
import { auth } from "@/_app/api-routes/auth";
import { resolveRedirect } from "@/_app/middleware-logic";

export default auth((req) => {
  const redirectTo = resolveRedirect(req.nextUrl.pathname, !!req.auth);
  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, req.nextUrl.origin));
  }
});

export const config = {
  // Static assets under /public (logos, icons, etc.) must stay reachable
  // even when the visitor isn't authenticated - the login/register pages
  // render the app logo before any session exists, so redirecting an
  // unauthenticated image request to /login made next/image's optimizer
  // fetch an HTML redirect instead of the file and fail with "isn't a
  // valid image".
  matcher: ["/((?!api/auth|_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif)$).*)"],
};
