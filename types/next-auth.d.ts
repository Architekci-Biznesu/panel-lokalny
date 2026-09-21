import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      accountId: string;
      activeProfileId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    accountId: string;
    activeProfileId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    accountId: string;
    activeProfileId: string | null;
  }
}
