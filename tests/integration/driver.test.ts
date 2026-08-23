import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Exercises the PRODUCTION database client — src/lib/db.ts, the real pg driver,
// over a real TCP socket — rather than an in-process substitute.
//
// This test exists because of a bug it would have caught. The previous client
// used drizzle-orm/netlify-db, whose Neon HTTP transport reached the deployed
// runtime missing a method it defines on itself; every query failed in
// production while the whole suite passed locally, because the tests drove a
// different driver (drizzle-orm/pglite) than the deployment did. Verifying the
// same module the app imports is the point.

const PORT = 55433;
let pg: PGlite;
let server: PGLiteSocketServer;

beforeAll(async () => {
  pg = new PGlite();
  await pg.waitReady;
  for (const m of readdirSync("netlify/database/migrations").filter((d) => !d.startsWith(".")).sort()) {
    const sql = readFileSync(join("netlify/database/migrations", m, "migration.sql"), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) if (stmt.trim()) await pg.exec(stmt);
  }
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1" });
  await server.start();
  process.env.NETLIFY_DB_URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;
}, 60_000);

afterAll(async () => {
  // Drain the connection pool BEFORE stopping the server; tearing the socket
  // out from under live connections surfaces as an unhandled
  // "Connection terminated unexpectedly".
  try {
    const { getDb } = await import("@/lib/db");
    await getDb().$client.end();
  } catch {
    // the pool may never have been created if the test failed early
  }
  await server?.stop();
  await pg?.close();
});

describe("production database client", () => {
  it("connects over TCP and reads through the real driver", async () => {
    // Imported after NETLIFY_DB_URL is set, since the client reads it lazily.
    const { getDb, isDbConfigured } = await import("@/lib/db");
    expect(isDbConfigured()).toBe(true);

    const { inventoryItems } = await import("@/lib/schema");
    const rows = await getDb().select().from(inventoryItems);
    expect(rows).toEqual([]);
  });

  it("round-trips a row through the same code path the app uses", async () => {
    const { getDb } = await import("@/lib/db");
    const { inventoryItems } = await import("@/lib/schema");

    await getDb().insert(inventoryItems).values({
      title: "Brass lamp",
      purchasePrice: 12.5,
      sellingPrice: 40,
      purchaseDate: "2026-01-15",
      soldDate: "2026-02-20",
    });

    const rows = await getDb().select().from(inventoryItems);
    expect(rows).toHaveLength(1);
    // Money must survive as an exact number, and a calendar date must not drift
    // into the neighbouring day through a timezone conversion.
    expect(rows[0].purchasePrice).toBe(12.5);
    expect(rows[0].sellingPrice).toBe(40);
    expect(rows[0].purchaseDate).toBe("2026-01-15");
    expect(rows[0].soldDate).toBe("2026-02-20");
  });

  it("derives status and profit from a row read over the wire", async () => {
    const { listItems } = await import("@/lib/items");
    const result = await listItems();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.items[0].status).toBe("SOLD");
    expect(result.items[0].profit).toBe(27.5);
  });
});
