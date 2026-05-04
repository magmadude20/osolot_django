import type { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOsolotAPI, PostType, type PostDetail, type PostSummary } from "../api/generated";
import "../App.css";
import { useAuth } from "../auth/AuthContext";

const api = getOsolotAPI();

function detailMessage(err: unknown): string {
  const ax = err as AxiosError<{ detail?: string }>;
  const d = ax.response?.data?.detail;
  return typeof d === "string" ? d : "Request failed.";
}

export default function Posts() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<PostSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PostDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const canUseApi = !!user && !loading;

  async function refresh() {
    if (!canUseApi) return;
    setError(null);
    try {
      const list = await api.osolotServerApiPostsListPosts();
      setItems(list);
    } catch (e) {
      setError(detailMessage(e));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseApi]);

  async function loadPreview(slug?: string) {
    if (!slug || !canUseApi) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const d = await api.osolotServerApiPostsGetPost(slug);
      setPreview(d);
    } catch (e) {
      setError(detailMessage(e));
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header row space-between">
        <div>
          <h1>Posts</h1>
          <p className="muted">Your offers and requests.</p>
        </div>
        {user ? (
          <Link to="/posts/new" className="btn">
            New post
          </Link>
        ) : null}
      </div>

      {!loading && !user ? (
        <section className="card">
          <p className="muted">You need to be signed in to manage posts.</p>
          <Link to="/login" className="btn">
            Log in
          </Link>
        </section>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <section className="card">
        <h2>Your posts</h2>
        {items === null && user ? <p className="muted">Loading…</p> : null}
        {items && items.length === 0 ? (
          <p className="muted">No posts yet.</p>
        ) : null}
        {items && items.length > 0 ? (
          <ul className="list post-list">
            {items.map((p) => (
              <li key={p.slug ?? p.title} className="post-list-item">
                <div className="post-list-main">
                  <button
                    type="button"
                    className="link as-button post-list-title"
                    onClick={() => void loadPreview(p.slug)}
                  >
                    <span className="badge">{p.type ?? PostType.offer}</span>
                    {p.title}
                  </button>
                  <div className="post-list-meta">
                    {p.slug ? (
                      <span className="muted small">slug: {p.slug}</span>
                    ) : null}
                  </div>
                </div>
                {p.slug ? (
                  <Link
                    to={`/posts/${p.slug}/edit`}
                    className="btn secondary btn-sm"
                  >
                    Edit
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {user && (preview || previewLoading) ? (
        <section className="card">
          <h2>Preview</h2>
          {previewLoading ? <p className="muted">Loading…</p> : null}
          {preview && !previewLoading ? (
            <>
              <p className="muted">
                <span className="badge">{preview.type ?? PostType.offer}</span>
                {preview.sharing?.public ? (
                  <span className="badge public">public</span>
                ) : null}
              </p>
              <h3>{preview.title}</h3>
              <p>{preview.description}</p>
              {preview.sharing?.shared_collectives &&
              preview.sharing.shared_collectives.length > 0 ? (
                <>
                  <h4>Shared with</h4>
                  <ul className="muted">
                    {preview.sharing.shared_collectives.map((c) => (
                      <li key={c.slug}>
                        {c.name}{" "}
                        <span className="small">({c.slug})</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">Not shared with any collective.</p>
              )}
              {preview.slug ? (
                <p className="row">
                  <Link
                    to={`/posts/${preview.slug}/edit`}
                    className="btn secondary"
                  >
                    Edit this post
                  </Link>
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
