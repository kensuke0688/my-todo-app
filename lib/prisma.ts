import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma Client for server-side use (Route Handlers only - never import from a
 * Client Component).
 *
 * Prisma 7 requires a driver adapter. We connect through Supabase's pooled
 * connection (DATABASE_URL, port 6543), which suits serverless request handlers.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. In local dev it comes from .env; on Vercel add it " +
        "under Project Settings > Environment Variables. Use the Supabase " +
        "'Transaction pooler' string (host *.pooler.supabase.com, port 6543) - " +
        "the direct db.<ref>.supabase.co host is IPv6-only and unreachable from Vercel.",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
