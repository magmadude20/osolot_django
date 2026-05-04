import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { AxiosError } from "axios";
import { PostType, type UserDetail, type UserSummary } from "../api/generated";
import { getOsolotAPI } from "../api/generated";
import "../App.css";
import { useAuth } from "../auth/AuthContext";

const api = getOsolotAPI();

function detailMessage(err: unknown): string {
  const ax = err as AxiosError<{ detail?: string }>;
  const d = ax.response?.data?.detail;
  return typeof d === "string" ? d : "Request failed.";
}

function displayName(u: UserSummary): string {
  const parts = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return parts || u.username;
}

type LocationState = { fromCollectiveSlug?: string } | null;

export default function UserProfile() {
  const { username: usernameParam } = useParams<{ username: string }>();
  const username = usernameParam ?? "";
  const location = useLocation();
  const fromCollectiveSlug =
    (location.state as LocationState)?.fromCollectiveSlug;
  const { user, loading: authLoading } = useAuth();

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [friendActionBusy, setFriendActionBusy] = useState(false);
  const [friendActionMsg, setFriendActionMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!username.trim()) {
      setDetail(null);
      setError("Missing username.");
      return;
    }
    if (authLoading) return;
    if (!user) {
      setDetail(null);
      setError(null);
      return;
    }
    setError(null);
    setDetail(null);
    void (async () => {
      try {
        const d = await api.osolotServerApiUsersGetUserProfile(username);
        setDetail(d);
      } catch {
        setError("Could not load this profile, or you do not have access.");
      }
    })();
  }, [username, user, authLoading]);

  async function addFriend() {
    if (!detail) return;
    setFriendActionBusy(true);
    setFriendActionMsg(null);
    setError(null);
    try {
      const res = await api.osolotServerApiUsersAddFriend(detail.summary.username);
      setFriendActionMsg(res.message);
    } catch (e) {
      setError(detailMessage(e));
    } finally {
      setFriendActionBusy(false);
    }
  }

  const backHref = fromCollectiveSlug
    ? `/collectives/${fromCollectiveSlug}`
    : "/collectives";
  const backLabel = fromCollectiveSlug ? "Back to collective" : "All collectives";

  if (authLoading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <header className="header">
          <h1>Member</h1>
          <div className="nav-links">
            <Link to={backHref} className="link">
              {backLabel}
            </Link>
          </div>
        </header>
        <section className="card">
          <p className="muted">
            Sign in to view member profiles and collectives you have in common.
          </p>
          <p>
            <Link
              to="/login"
              className="btn"
              state={{
                from: `/users/${encodeURIComponent(username)}`,
              }}
            >
              Log in
            </Link>
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Member</h1>
        <div className="nav-links">
          <Link to={backHref} className="link">
            {backLabel}
          </Link>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {!error && detail === null ? <p className="muted">Loading…</p> : null}

      {detail ? (
        <>
          <section className="card">
            <div className="row space-between">
              <h2>{displayName(detail.summary)}</h2>
              {user?.username !== detail.summary.username ? (
                <button
                  type="button"
                  className="btn"
                  disabled={friendActionBusy}
                  onClick={() => void addFriend()}
                >
                  {friendActionBusy ? "Adding…" : "Add friend"}
                </button>
              ) : null}
            </div>
            <p className="muted user-profile-username">
              @{detail.summary.username}
            </p>
            {friendActionMsg ? <p className="muted">{friendActionMsg}</p> : null}
            {detail.bio ? <p className="user-profile-bio">{detail.bio}</p> : null}
            {user?.username === detail.summary.username ? (
              <p className="muted">
                This is you.{" "}
                <Link to="/" className="link">
                  Edit profile on home
                </Link>
              </p>
            ) : null}
          </section>

          <section className="card">
            <h2>Collectives in common</h2>
            {detail.mutual_collectives.length === 0 ? (
              <p className="muted">
                No other active memberships in common, or none you can both see
                here.
              </p>
            ) : (
              <ul className="collective-list">
                {detail.mutual_collectives.map((c) => (
                  <li key={c.slug ?? c.name}>
                    <Link
                      to={`/collectives/${c.slug ?? ""}`}
                      className="collective-link"
                    >
                      <span className="collective-name">{c.name}</span>
                      {c.description ? (
                        <span className="collective-desc">{c.description}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>Mutual friends</h2>
            {detail.mutual_friends.length === 0 ? (
              <p className="muted">No mutual friends yet.</p>
            ) : (
              <ul className="list">
                {detail.mutual_friends.map((u) => (
                  <li key={u.username}>
                    <Link
                      to={`/users/${encodeURIComponent(u.username)}`}
                      className="link"
                    >
                      {displayName(u)}{" "}
                      <span className="muted small">@{u.username}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {user?.username !== detail.summary.username ? (
            <section className="card">
              <h2>Posts visible to you</h2>
              <p className="muted small">
                Offers and requests from this member that you can see (for example
                through collectives or friendship).
              </p>
              {detail.posts_shared_with_me.length === 0 ? (
                <p className="muted">
                  None yet — you will see their posts here when sharing overlaps
                  with your account.
                </p>
              ) : (
                <ul className="shared-posts-list">
                  {detail.posts_shared_with_me.map((p) => {
                    const slug = p.slug ?? "";
                    return (
                      <li key={slug || p.title}>
                        <span className="badge">{p.type ?? PostType.offer}</span>
                        {slug ? (
                          <Link to={`/posts/browse/${encodeURIComponent(slug)}`}>
                            {p.title}
                          </Link>
                        ) : (
                          <span>{p.title}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
