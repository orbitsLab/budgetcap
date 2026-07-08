/**
 * Prisma v7 (new `prisma-client` generator) requires an adapter.
 * We use @prisma/adapter-pg with the node-postgres (pg) driver.
 *
 * The DATABASE_URL from .env is used. When using the `prisma+postgres` local
 * dev URL, Prisma internally maps it to a regular postgres:// URL.
 */
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// @ts-ignore — Prisma v7 generated client
import { PrismaClient } from "../app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
};

function createPrismaClient() {
  // For Prisma Postgres URLs (`prisma+postgres://...`), we need to extract
  // the underlying postgres URL from the API key's base64 payload.
  // For standard `postgresql://` URLs, we use them directly.
  let connectionString = process.env.DATABASE_URL ?? "";

  if (connectionString.startsWith("prisma+postgres://")) {
    // Extract the real postgres URL from the encoded API key
    try {
      const url = new URL(connectionString);
      const apiKey = url.searchParams.get("api_key") ?? "";
      const decoded = JSON.parse(Buffer.from(apiKey, "base64url").toString("utf8"));
      connectionString = decoded.databaseUrl ?? connectionString;
    } catch {
      // If parsing fails, fall through with the original URL
      // The Prisma dev server should handle it
    }
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (PrismaClient as any)({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
