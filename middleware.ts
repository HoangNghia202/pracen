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
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
