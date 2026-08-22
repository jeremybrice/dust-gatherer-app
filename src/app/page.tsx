import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/items";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default async function InventoryPage() {
  await requireSession();
  const items = await listItems();

  return (
    <div className="container">
      <header className="app">
        <h1>Dust Gatherer</h1>
        <a href="/settings/import">Import</a>
      </header>

      {items === null ? (
        <p className="notice">
          The database is not configured yet. Set <code>NETLIFY_DB_URL</code> and apply
          migrations, then reload.
        </p>
      ) : items.length === 0 ? (
        <p className="notice">
          No items yet. <a href="/settings/import">Import a backup</a> from the Android app
          to bring your inventory across.
        </p>
      ) : (
        <ul className="items">
          {items.map((item) => (
            <li key={item.id} className="item">
              {item.imageKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/images/${item.imageKey}`} alt="" loading="lazy" />
              ) : (
                <div className="thumb-empty" />
              )}
              <div className="body">
                <h2>{item.title}</h2>
                <p className="meta">
                  Paid {money(item.purchasePrice)}
                  {item.profit !== null && <> · Profit {money(item.profit)}</>}
                  {item.category && <> · {item.category}</>}
                </p>
              </div>
              <span className={`badge ${item.status}`}>{item.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
