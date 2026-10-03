import { auth } from "@/lib/auth";
import { markAccountActive } from "@/lib/activity";
import { AppShell } from "@/features/shell/app-shell";
import {
  getAdminSwitcherProps,
  listAccountProfileOptions,
  resolveSwitcherProfileId,
} from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userName = session?.user?.name ?? session?.user?.email ?? "Użytkownik";
  const userEmail = session?.user?.email ?? null;
  const adminChrome = await getAdminSwitcherProps();
  // The customer's own visit (not staff looking in) - see lib/activity.ts.
  if (session?.user?.accountId && !session.user.adminImpersonating) {
    await markAccountActive(session.user.accountId).catch((error) =>
      console.error("Account activity write failed:", error),
    );
  }

  let profiles: {
    id: string;
    name: string;
    location: string | null;
    groupId: string | null;
    groupName: string | null;
  }[] = [];
  let activeProfileId: string | null = null;
  try {
    profiles = await listAccountProfileOptions();
    activeProfileId = await resolveSwitcherProfileId(
      session?.user?.activeProfileId ?? null,
    );
  } catch {
    profiles = [];
    activeProfileId = null;
  }

  return (
    <AppShell
      profiles={profiles}
      activeProfileId={activeProfileId}
      userName={userName}
      userEmail={userEmail}
      adminImpersonating={adminChrome.adminImpersonating}
      ownerEmail={adminChrome.ownerEmail}
    >
      {children}
    </AppShell>
  );
}
