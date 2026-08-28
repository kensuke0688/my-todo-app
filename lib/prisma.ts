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
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
