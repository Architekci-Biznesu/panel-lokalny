import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

async function readIsStaff(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const [user] = await db
    .select({ isStaff: users.isStaff })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.isStaff === true;
}

export const proxy = auth(async (req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAuthPage = pathname === "/logowanie" || pathname === "/rejestracja";
  const isApi = pathname.startsWith("/api");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isOnboarding = pathname === "/onboarding";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
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
  const isStaff = await readIsStaff(req.auth?.user?.id);
  const hasWorkingProfile = !!activeProfileId;

  if (isAuthPage) {
    let target = "/onboarding";
    if (hasWorkingProfile) {
      target = "/pulpit";
    } else if (isStaff) {
      target = "/admin";
    }
    return NextResponse.redirect(new URL(target, req.nextUrl.origin));
  }

  if (isAdminRoute) {
    return NextResponse.next();
  }

  // Onboarding gate for UI only - never redirect /api/*
  if (!isApi && !hasWorkingProfile && !isOnboarding) {
    const target = isStaff ? "/admin" : "/onboarding";
    return NextResponse.redirect(new URL(target, req.nextUrl.origin));
  }

  // Allow /onboarding?mode=add even when a profile is already active
  if (!isApi && hasWorkingProfile && isOnboarding && !isAddProfile) {
    return NextResponse.redirect(new URL("/pulpit", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
