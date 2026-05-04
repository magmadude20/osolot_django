import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { PostDetail, PostSummary } from "../api/generated";
import { PostType } from "../api/generated";
import {
    fetchPostDetail,
    fetchVisiblePosts,
    isAbortError,
    isValidPostSlug,
} from "../api/posts-queries";
import "../App.css";
import { useAuth } from "../auth/AuthContext";

export default function PostsBrowse() {
  const { postSlug } = useParams<{ postSlug?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [list, setList] = useState<PostSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const slugOk = postSlug === undefined || isValidPostSlug(postSlug);

  useEffect(() => {
    const ac = new AbortController();
    setListError(null);
    (async () => {
      try {
        const items = await fetchVisiblePosts(ac.signal);
        setList(items);
      } catch (e) {
        if (isAbortError(e)) return;
        setListError(
          "Could not load posts. If this persists, the feed endpoint may need to be enabled or OpenAPI regenerated.",
        );
        setList([]);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!postSlug || !slugOk) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    const ac = new AbortController();
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    (async () => {
      try {
        const d = await fetchPostDetail(postSlug, ac.signal);
        if (!ac.signal.aborted) setDetail(d);
      } catch {
        if (!ac.signal.aborted) {
          setDetailError("Could not load this post, or you do not have access.");
        }
      } finally {
        if (!ac.signal.aborted) setDetailLoading(false);
      }
    })();
    return () => ac.abort();
  }, [postSlug, slugOk]);

  function openPost(slug: string) {
    navigate(`/posts/browse/${slug}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>View posts</h1>
        <p className="muted">
          Posts you can see: public posts, posts shared with collectives you belong
          to, and your own. Sign in to see more than public-only content.
        </p>
      </div>

      {listError ? <p className="error">{listError}</p> : null}
      {!slugOk && postSlug ? (
        <p className="error">Invalid post link.</p>
      ) : null}

      <div className="browse-grid">
        <section className="card">
          <h2>All visible posts</h2>
          {list === null ? <p className="muted">Loading…</p> : null}
          {list && list.length === 0 ? (
            <p className="muted">No posts to show yet.</p>
          ) : null}
          {list && list.length > 0 ? (
            <ul className="list post-list">
              {list.map((p) => {
                const slug = p.slug ?? "";
                return (
                  <li key={slug || p.title} className="post-list-item">
                    <div className="post-list-main">
                      <button
                        type="button"
                        className="link as-button post-list-title"
                        onClick={() => slug && openPost(slug)}
                        disabled={!slug}
                      >
                        <span className="badge">{p.type ?? PostType.offer}</span>
                        {p.title}
                      </button>
                      <div className="post-list-meta">
                        <span className="muted small">@{p.owner.username}</span>
                        {slug ? (
                          <span className="muted small">slug: {slug}</span>
                        ) : null}
                      </div>
                    </div>
                    {slug ? (
                      <Link
                        to={`/posts/browse/${slug}`}
                        className="btn secondary btn-sm"
                      >
                        Open
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <section className="card browse-detail">
          <h2>Post detail</h2>
          {!postSlug ? (
            <p className="muted">Select a post from the list.</p>
          ) : null}
          {postSlug && detailLoading ? <p className="muted">Loading…</p> : null}
          {postSlug && detailError ? <p className="error">{detailError}</p> : null}
          {detail && !detailLoading ? (
            <>
              <p className="muted">
                <span className="badge">{detail.type ?? PostType.offer}</span>
                {detail.sharing?.public ? (
                  <span className="badge public">public</span>
                ) : null}
              </p>
              <p className="muted small">
                @{detail.owner.username}
              </p>
              <h3>{detail.title}</h3>
              <p>{detail.description}</p>
              <p className="row">
                <Link to="/posts/browse" className="btn secondary">
                  Clear selection
                </Link>
                {user && detail.owner.username === user.username && detail.slug ? (
                  <Link to={`/posts/${detail.slug}/edit`} className="btn">
                    Edit post
                  </Link>
                ) : null}
              </p>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
