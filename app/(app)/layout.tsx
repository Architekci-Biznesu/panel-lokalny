import { auth } from "@/lib/auth";
import { AppShell } from "@/features/shell/app-shell";
import {
  getAdminSwitcherProps,
  listAccountProfiles,
} from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userName = session?.user?.name ?? session?.user?.email ?? "Użytkownik";
  const adminChrome = await getAdminSwitcherProps();

  let profiles: { id: string; name: string }[] = [];
  try {
    profiles = (await listAccountProfiles()).map((p) => ({
      id: p.id,
      name: p.name,
    }));
  } catch {
    profiles = [];
  }

  return (
    <AppShell
      profiles={profiles}
      activeProfileId={session?.user?.activeProfileId ?? null}
      userName={userName}
      adminImpersonating={adminChrome.adminImpersonating}
      ownerEmail={adminChrome.ownerEmail}
    >
      {children}
    </AppShell>
  );
}
