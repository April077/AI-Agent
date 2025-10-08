import 'dotenv/config';
import { PrismaClient } from "../generated/client/client";


// Prevent multiple instances in development (important for Next.js hot reload)
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"], // optional: helpful in dev
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Optional: re-export everything from Prisma Client
export * from "../generated/client/client";
