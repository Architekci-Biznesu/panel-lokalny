import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireOwnedProfile } from "@/lib/session";

const paramsSchema = z.object({
  profileId: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ profileId: string }>;
};

/**
 * Isolation probe: returns profile data only when it belongs to the active account.
 * Used to verify multi-tenant access control (403 for foreign profileId).
 */
export async function GET(_request: Request, context: RouteContext) {
  const raw = await context.params;
  const parsed = paramsSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowy profileId" }, { status: 400 });
  }

  try {
    const profile = await requireOwnedProfile(parsed.data.profileId);
    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      kind: profile.kind,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
