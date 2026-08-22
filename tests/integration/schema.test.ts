import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers/pg";

describe("generated migration", () => {
  it("creates every table and index", async () => {
    const db = await freshDb();
    const tables = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema='public' order by 1`,
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      "categories", "inventory_items", "login_attempts", "sites",
    ]);

    const indexes = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname='public' and indexname like '%_idx' order by 1`,
    );
    expect(indexes.rows.map((r) => r.indexname)).toEqual([
      "inventory_created_idx",
      "inventory_posted_idx",
      "inventory_scheduled_idx",
      "inventory_sold_idx",
      "login_attempts_last_failure_idx",
    ]);
    await db.close();
  });

  // The importer's REPLACE_EXISTING path writes ids taken from a backup. Under
  // GENERATED ALWAYS that insert is rejected outright, so this test pins the
  // column to BY DEFAULT.
  it("accepts an explicit id and still autogenerates one", async () => {
    const db = await freshDb();
    await db.query(
      `insert into inventory_items (id,title,purchase_price,purchase_date) values (42,'explicit',1.50,'2026-01-02')`,
    );
    await db.query(
      `insert into inventory_items (title,purchase_price,purchase_date) values ('auto',2.25,'2026-01-03')`,
    );
    const rows = await db.query<{ id: string; title: string }>(
      `select id, title from inventory_items order by title`,
    );
    expect(rows.rows.map((r) => r.title)).toEqual(["auto", "explicit"]);
    expect(Number(rows.rows[1].id)).toBe(42);
    await db.close();
  });

  // Money must survive a round trip exactly; a float column would not.
  it("stores money exactly and dates without timezone shift", async () => {
    const db = await freshDb();
    await db.query(
      `insert into inventory_items (title,purchase_price,selling_price,purchase_date)
       values ('cents', 19.99, 0.10, '2026-03-01')`,
    );
    const r = await db.query<{ purchase_price: string; selling_price: string; purchase_date: string }>(
      `select purchase_price::text, selling_price::text, purchase_date::text from inventory_items`,
    );
    expect(r.rows[0].purchase_price).toBe("19.99");
    expect(r.rows[0].selling_price).toBe("0.10");
    expect(r.rows[0].purchase_date).toBe("2026-03-01");
    await db.close();
  });
});
