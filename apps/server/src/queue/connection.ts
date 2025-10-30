import dotenv from "dotenv";
dotenv.config();

import { Redis } from "ioredis";
console.log("REDIS_URL:", process.env.REDIS_URL);
if (!process.env.REDIS_URL) {
  console.error("❌ Missing REDIS_URL in environment variables");
  process.exit(1);
}

export const connection = new Redis(process.env.REDIS_URL, {
  tls: process.env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
  maxRetriesPerRequest: null,
});
