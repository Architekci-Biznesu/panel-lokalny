import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isCurrentUserStaff } from "@/lib/session";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/logowanie");
  }

  if (!session.user.activeProfileId) {
    if (await isCurrentUserStaff()) {
      redirect("/admin");
    }
    redirect("/onboarding");
  }

  redirect("/pulpit");
}
