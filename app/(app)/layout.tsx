import { auth } from "@/lib/auth";
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

  let profiles: { id: string; name: string; location: string | null }[] = [];
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
