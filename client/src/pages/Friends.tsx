import { useEffect, useState } from "react";
import type { AxiosError } from "axios";
import { Link } from "react-router-dom";
import { getOsolotAPI, type UserSummary } from "../api/generated";
import { useAuth } from "../auth/AuthContext";
import "../App.css";

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

export default function Friends() {
  const { user, loading: authLoading } = useAuth();

  const [pending, setPending] = useState<UserSummary[] | null>(null);
  const [active, setActive] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    setError(null);
    try {
      const [reqs, friends] = await Promise.all([
        api.osolotServerApiUsersListMyFriendRequests(),
        api.osolotServerApiUsersListMyFriends(),
      ]);
      setPending(reqs);
      setActive(friends);
    } catch (e) {
      setError(detailMessage(e));
      setPending([]);
      setActive([]);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.username]);

  async function acceptRequest(username: string) {
    setBusyKey(`accept:${username}`);
    setError(null);
    try {
      await api.osolotServerApiUsersAddFriend(username);
      await refresh();
    } catch (e) {
      setError(detailMessage(e));
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteRequest(username: string) {
    const ok = confirm("Delete this friend request?");
    if (!ok) return;
    setBusyKey(`deleteRequest:${username}`);
    setError(null);
    try {
      await api.osolotServerApiUsersRemoveFriend(username);
      await refresh();
    } catch (e) {
      setError(detailMessage(e));
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteFriend(username: string) {
    const ok = confirm("Remove this friend? This cannot be undone.");
    if (!ok) return;
    setBusyKey(`deleteFriend:${username}`);
    setError(null);
    try {
      await api.osolotServerApiUsersRemoveFriend(username);
      await refresh();
    } catch (e) {
      setError(detailMessage(e));
    } finally {
      setBusyKey(null);
    }
  }

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
        <div className="page-header">
          <h1>Friends</h1>
          <p className="muted">Sign in to view and manage friendships.</p>
        </div>
        <Link to="/login" className="btn">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Friends</h1>
        <p className="muted">
          Friend requests appear first. Active friends are listed below.
        </p>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <section className="card">
        <div className="row space-between">
          <h2>Pending friend requests</h2>
          <button type="button" className="btn secondary" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        {pending === null ? <p className="muted">Loading…</p> : null}
        {pending && pending.length === 0 ? (
          <p className="muted">No pending friend requests.</p>
        ) : null}
        {pending && pending.length > 0 ? (
          <ul className="list">
            {pending.map((u) => (
              <li key={u.username} className="row space-between">
                <div>
                  <Link to={`/users/${encodeURIComponent(u.username)}`} className="link">
                    {displayName(u)}
                  </Link>
                  <div className="muted small">@{u.username}</div>
                </div>
                <div className="row">
                  <button
                    type="button"
                    className="btn"
                    disabled={busyKey === `accept:${u.username}`}
                    onClick={() => void acceptRequest(u.username)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    disabled={busyKey === `deleteRequest:${u.username}`}
                    onClick={() => void deleteRequest(u.username)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card">
        <h2>Active friends</h2>
        {active === null ? <p className="muted">Loading…</p> : null}
        {active && active.length === 0 ? <p className="muted">No friends yet.</p> : null}
        {active && active.length > 0 ? (
          <ul className="list">
            {active.map((u) => (
              <li key={u.username} className="row space-between">
                <div>
                  <Link to={`/users/${encodeURIComponent(u.username)}`} className="link">
                    {displayName(u)}
                  </Link>
                  <div className="muted small">@{u.username}</div>
                </div>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busyKey === `deleteFriend:${u.username}`}
                  onClick={() => void deleteFriend(u.username)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

