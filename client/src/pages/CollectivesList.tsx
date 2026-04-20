import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CollectiveSummary } from "../api/generated";
import {
  fetchPublicCollectives,
  isAbortError,
} from "../api/collectives-queries";
import "../App.css";

export default function CollectivesList() {
  const [items, setItems] = useState<CollectiveSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const list = await fetchPublicCollectives(ac.signal);
        setItems(list);
      } catch (e) {
        if (isAbortError(e)) return;
        setError("Could not load collectives.");
      }
    })();
    return () => ac.abort();
  }, []);

  return (
    <div className="page">
      <header className="header">
        <h1>Collectives</h1>
        <div className="nav-links">
          <Link to="/collectives/new" className="btn">
            Add new collective
          </Link>
          <Link to="/" className="link">
            Home
          </Link>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {items === null && !error ? <p className="muted">Loading…</p> : null}
      {items && items.length === 0 ? (
        <p className="muted">No public collectives yet.</p>
      ) : null}
      {items && items.length > 0 ? (
        <ul className="collective-list">
          {items.map((c) => (
            <li key={c.slug}>
              <Link to={`/collectives/${c.slug}`} className="collective-link">
                <span className="collective-name">{c.name}</span>
                {c.description ? (
                  <span className="collective-desc">{c.description}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
