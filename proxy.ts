import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAuthPage =
    pathname === "/logowanie" || pathname === "/rejestracja";
  const isApi = pathname.startsWith("/api");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isOnboarding = pathname === "/onboarding";
  const isAddProfile =
    isOnboarding && req.nextUrl.searchParams.get("mode") === "add";

  if (isAuthApi) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (isAuthPage || isApi) {
      return NextResponse.next();
    }
    const loginUrl = new URL("/logowanie", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const activeProfileId = req.auth?.user?.activeProfileId ?? null;

  if (isAuthPage) {
    const target = activeProfileId ? "/pulpit" : "/onboarding";
    return NextResponse.redirect(new URL(target, req.nextUrl.origin));
  }

  // Onboarding gate for UI only - never redirect /api/*
  if (!isApi && !activeProfileId && !isOnboarding) {
    return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
  }

  // Allow /onboarding?mode=add even when a profile is already active
  if (!isApi && activeProfileId && isOnboarding && !isAddProfile) {
    return NextResponse.redirect(new URL("/pulpit", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
