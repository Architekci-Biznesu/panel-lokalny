import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// One connection pool per process. In dev every code change re-evaluates this
// module; without the global each reload opened a new pool (up to 10
// connections) and never closed the old one, until Neon stopped accepting new
// connections (CONNECT_TIMEOUT - failed logins and lost sessions).
const globalForDb = globalThis as typeof globalThis & {
  __pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__pgClient ?? postgres(connectionString, { prepare: false });

if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = client;

export const db = drizzle(client, { schema });
