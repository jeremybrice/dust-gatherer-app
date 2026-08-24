import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/items";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default async function InventoryPage() {
  await requireSession();
  const result = await listItems();

  return (
    <div className="container">
      <header className="app">
        <h1>Dust Gatherer</h1>
        <nav className="nav">
          <a href="/items/new">Add item</a>
          <a href="/settings/export">Export</a>
          <a href="/settings/import">Import</a>
        </nav>
      </header>

      {result.status === "unconfigured" ? (
        <p className="notice">
          The database is not configured yet. Set <code>NETLIFY_DB_URL</code> and apply
          migrations, then reload.
        </p>
      ) : result.status === "error" ? (
        <p className="notice">
          The inventory could not be loaded. The database reported:
          <br />
          <code>{result.message}</code>
        </p>
      ) : result.items.length === 0 ? (
        <p className="notice">
          No items yet. <a href="/items/new">Add your first item</a> or{" "}
          <a href="/settings/import">import a backup</a> from the Android app.
        </p>
      ) : (
        <ul className="items">
          {result.items.map((item) => (
            <li key={item.id}>
              <a className="item-link" href={`/items/${item.id}`}>
                <div className="item">
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
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
