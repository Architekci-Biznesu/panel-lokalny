import { NextResponse } from "next/server";
import { AuthError, getActiveProfile } from "@/lib/session";

/**
 * Returns the active profile for the current session.
 * Without a profile: 403 (not a redirect) - used to verify API bypasses onboarding gate.
 */
export async function GET() {
  try {
    const profile = await getActiveProfile();
    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      kind: profile.kind,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
