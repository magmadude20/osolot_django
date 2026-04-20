import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  CollectiveDetail,
  MembershipDetail,
  Role,
} from "../api/generated";
import { getOsolotAPI } from "../api/generated";
import {
  fetchCollective,
  fetchMembership,
  isAbortError,
  isValidCollectiveSlug,
} from "../api/collectives-queries";
import { useAuth } from "../auth/AuthContext";
import "../App.css";

const api = getOsolotAPI();
const ROLES = ["admin", "moderator", "member"] as const;

function formatWhen(iso: string | undefined | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function CollectiveManageMember() {
  const { collectiveSlug, userId } = useParams<{
    collectiveSlug: string;
    userId: string;
  }>();
  const slug = collectiveSlug ?? "";
  const slugOk = isValidCollectiveSlug(slug);
  const targetUserId = userId ? Number.parseInt(userId, 10) : NaN;

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [collective, setCollective] = useState<CollectiveDetail | null>(null);
  const [membership, setMembership] = useState<MembershipDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slugOk || !Number.isFinite(targetUserId)) {
      setLoadError("Invalid collective or user.");
      return;
    }
    const ac = new AbortController();
    setLoadError(null);
    setPageError(null);
    setCollective(null);
    setMembership(null);
    void (async () => {
      try {
        const c = await fetchCollective(slug, ac.signal);
        const m = await fetchMembership(slug, targetUserId, ac.signal);
        if (ac.signal.aborted) return;
        setCollective(c);
        setMembership(m);
      } catch (e) {
        if (isAbortError(e)) return;
        setLoadError("Could not load member or collective.");
      }
    })();
    return () => ac.abort();
  }, [slug, slugOk, targetUserId]);

  const canManage = useMemo(() => {
    if (!user || !collective) return false;
    return collective.members.some(
      (m) =>
        m.user.id === user.id &&
        m.status === "active" &&
        (m.role === "admin" || m.role === "moderator"),
    );
  }, [user, collective]);

  const isAdmin = useMemo(() => {
    if (!user || !collective) return false;
    return collective.members.some(
      (m) => m.user.id === user.id && m.status === "active" && m.role === "admin",
    );
  }, [user, collective]);

  async function refresh() {
    const m = await api.osolotServerApiCollectiveMembershipsGetMembership(
      slug,
      targetUserId,
    );
    setMembership(m);
  }

  async function withBusy(fn: () => Promise<unknown>) {
    setPageError(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch {
      setPageError("That action failed. Check permissions or try again.");
    } finally {
      setBusy(false);
    }
  }

  const backHref = slugOk ? `/collectives/${slug}/members/manage` : "/collectives";

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
          <h1>Manage member</h1>
          <Link to={backHref} className="link">
            Back
          </Link>
        </header>
        <p className="muted">Log in to manage members.</p>
        <Link to="/login" state={{ from: backHref }} className="btn">
          Log in
        </Link>
      </div>
    );
  }

  if (loadError || !slugOk || !Number.isFinite(targetUserId)) {
    return (
      <div className="page">
        <p className="error">{loadError ?? "Invalid collective or user."}</p>
        <Link to="/collectives" className="link">
          All collectives
        </Link>
      </div>
    );
  }

  if (!collective || !membership) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="page">
        <header className="header">
          <h1>Manage member</h1>
          <Link to={backHref} className="link">
            Back
          </Link>
        </header>
        <p className="error">Only admins and moderators can manage members.</p>
      </div>
    );
  }

  const pending = membership.summary.status === "pending";
  const name =
    `${membership.summary.user.first_name} ${membership.summary.user.last_name}`.trim() ||
    `User #${membership.summary.user.id}`;

  function handleApprove() {
    void withBusy(() =>
      api.osolotServerApiCollectiveMembershipsUpdateMembership(slug, targetUserId, {
        status: "active",
      }),
    );
  }

  function handleDecline() {
    const ok = window.confirm(
      `Decline ${name}'s application? Their membership request will be removed.`,
    );
    if (!ok) return;
    void withBusy(() =>
      api.osolotServerApiCollectiveMembershipsDeleteMembership(slug, targetUserId),
    ).then(() => navigate(backHref, { replace: true }));
  }

  function handleRemove() {
    const ok = window.confirm(
      `Remove ${name} from this collective?\n\nThis immediately revokes access. They can rejoin later if allowed.`,
    );
    if (!ok) return;
    void withBusy(() =>
      api.osolotServerApiCollectiveMembershipsDeleteMembership(slug, targetUserId),
    ).then(() => navigate(backHref, { replace: true }));
  }

  function handleRoleChange(role: Role) {
    void withBusy(() =>
      api.osolotServerApiCollectiveMembershipsUpdateMembership(slug, targetUserId, {
        role,
      }),
    );
  }

  return (
    <div className="page manage-member-detail">
      <header className="header">
        <h1>Manage member</h1>
        <div className="nav-links">
          <Link to={backHref} className="link">
            Back
          </Link>
          <Link to={`/collectives/${slug}`} className="link">
            Collective
          </Link>
        </div>
      </header>

      {pageError ? <p className="error">{pageError}</p> : null}

      <section className={`card ${pending ? "pending" : ""}`}>
        <div className="manage-member-title">
          <strong>{name}</strong>
          <span className="member-meta">
            {membership.summary.role} · {membership.summary.status}
          </span>
        </div>

        <dl className="kv manage-member-dates">
          <div>
            <dt>Applied</dt>
            <dd>{formatWhen(membership.applied_at)}</dd>
          </div>
          <div>
            <dt>Joined / accepted</dt>
            <dd>{pending ? "—" : formatWhen(membership.joined_at)}</dd>
          </div>
          <div>
            <dt>Approved by</dt>
            <dd>
              {membership.approved_by
                ? `${membership.approved_by.first_name} ${membership.approved_by.last_name}`.trim() ||
                  `User #${membership.approved_by.id}`
                : "—"}
            </dd>
          </div>
        </dl>

        {membership.application_message ? (
          <p className="muted manage-app-msg">
            <strong>Application message:</strong> {membership.application_message}
          </p>
        ) : null}

        <div className="manage-member-actions">
          {pending ? (
            <>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={handleApprove}
              >
                {busy ? "…" : "Approve"}
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={handleDecline}
              >
                Decline
              </button>
            </>
          ) : null}

          {isAdmin ? (
            <label className="manage-role-label">
              Role
              <select
                className="manage-role-select"
                value={membership.summary.role}
                disabled={busy}
                onChange={(e) => handleRoleChange(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

        </div>

        {targetUserId !== user.id ? (
          <div className="danger-zone">
            <div className="danger-zone-meta">
              <strong>Danger zone</strong>
              <span className="muted">
                Removing a member immediately revokes access.
              </span>
            </div>
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={handleRemove}
            >
              Remove member
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

