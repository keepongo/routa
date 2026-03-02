/**
 * Database Connection — Multi-Driver Support
 *
 * Supports two database backends:
 * - **Postgres** (Neon Serverless): Used in Web/Vercel deployments
 * - **Postgres** (standard postgres-js): Used in CI and local Postgres setups
 * - **SQLite** (better-sqlite3): Used in desktop deployments (Tauri/Electron)
 *
 * The driver is selected based on the platform bridge configuration.
 * Connection is lazy-initialized and cached for the lifetime of the process.
 * In Next.js dev mode, the instance survives HMR via globalThis.
 *
 * For Postgres: Requires DATABASE_URL environment variable.
 *   - Neon URLs (containing "neon.tech"): use @neondatabase/serverless
 *   - Standard URLs (localhost, RDS, etc.): use postgres-js driver
 * For SQLite: Uses local file (default: routa.db in app data directory).
 */

import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// ─── Type Exports ───────────────────────────────────────────────────────

export type PostgresDatabase = NeonHttpDatabase<typeof schema>;

/**
 * Union type for all supported database instances.
 * Callers that need type-specific operations should narrow via
 * getDatabaseType() or use the platform bridge's db.type.
 */
export type Database = PostgresDatabase;

// ─── Database Type Detection ────────────────────────────────────────────

export type DatabaseDriver = "postgres" | "sqlite" | "memory";

/**
 * Determine which database driver to use based on environment.
 *
 * Priority:
 * 1. ROUTA_DB_DRIVER env var (explicit override)
 * 2. DATABASE_URL present → postgres
 * 3. Desktop platform (Tauri/Electron) → sqlite
 * 4. Fallback → memory
 */
export function getDatabaseDriver(): DatabaseDriver {
  // Explicit override
  const driverOverride = process.env.ROUTA_DB_DRIVER;
  if (driverOverride === "postgres" || driverOverride === "sqlite" || driverOverride === "memory") {
    return driverOverride;
  }

  // Postgres if DATABASE_URL is set
  if (process.env.DATABASE_URL) {
    return "postgres";
  }

  // Desktop environments default to SQLite
  // (Detected by absence of DATABASE_URL in non-serverless env)
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "sqlite";
  }

  return "memory";
}

// ─── Postgres Connection ────────────────────────────────────────────────

const PG_GLOBAL_KEY = "__routa_db__";

/**
 * Returns true when the URL targets a Neon serverless endpoint.
 * Neon requires @neondatabase/serverless (HTTP/WebSocket); standard Postgres
 * needs the postgres-js driver (TCP).
 */
function isNeonUrl(url: string): boolean {
  return url.includes("neon.tech") || url.includes(".neon.database");
}

export function getPostgresDatabase(): PostgresDatabase {
  const g = globalThis as Record<string, unknown>;
  if (!g[PG_GLOBAL_KEY]) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL environment variable is required for Postgres. " +
        "Set it in .env.local for local dev or in Vercel project settings for production."
      );
    }
    // Debug: Log the DATABASE_URL to stderr (masking password for security)
    const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':***@');
    console.error(`[DB] Connecting to Postgres: ${maskedUrl}`);

    if (isNeonUrl(databaseUrl)) {
      // Neon serverless: uses HTTP transport — suitable for Vercel/edge deployments
      console.error("[DB] Using Neon serverless driver (HTTP)");
      const sql = neon(databaseUrl);
      g[PG_GLOBAL_KEY] = neonDrizzle(sql, { schema });
    } else {
      // Standard Postgres (local, RDS, CI, Docker, etc.): uses TCP via postgres-js
      console.error("[DB] Using standard postgres-js driver (TCP)");
      const client = postgres(databaseUrl, { max: 10 });
      // Cast: both NeonHttpDatabase and PostgresJsDatabase share the drizzle query API
      g[PG_GLOBAL_KEY] = pgDrizzle(client, { schema }) as unknown as PostgresDatabase;
    }
  }
  return g[PG_GLOBAL_KEY] as PostgresDatabase;
}

// ─── Unified Database Accessor ──────────────────────────────────────────

/**
 * Get the database instance for the current environment.
 *
 * Returns a Postgres database if DATABASE_URL is configured,
 * otherwise returns a SQLite database for desktop environments.
 *
 * @throws Error if no database can be configured
 */
export function getDatabase(): Database {
  const driver = getDatabaseDriver();

  switch (driver) {
    case "postgres":
      return getPostgresDatabase();
    case "sqlite":
      // SQLite is loaded dynamically to avoid bundling better-sqlite3 in web builds.
      // Use createSqliteSystem() from routa-system.ts for SQLite support.
      throw new Error(
        "SQLite database should be accessed via createSqliteSystem(). " +
        "Do not call getDatabase() directly for SQLite."
      );
    case "memory":
      throw new Error(
        "No database configured. Set DATABASE_URL for Postgres " +
        "or use ROUTA_DB_DRIVER=sqlite for local SQLite storage."
      );
  }
}

/**
 * Check if any database backend is configured.
 * Used by the system factory to decide between DB-backed and InMemory stores.
 */
export function isDatabaseConfigured(): boolean {
  const driver = getDatabaseDriver();
  return driver === "postgres" || driver === "sqlite";
}

/**
 * Check if the database is Postgres.
 */
export function isPostgres(): boolean {
  return getDatabaseDriver() === "postgres";
}

/**
 * Check if the database is SQLite.
 */
export function isSqlite(): boolean {
  return getDatabaseDriver() === "sqlite";
}
