import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getOsolotAPI, type CollectiveDetail } from "../api/generated";
import type { MembershipDetail } from "../api/generated";
import {
  fetchCollective,
  fetchMembership,
  isAbortError,
  isValidCollectiveSlug,
} from "../api/collectives-queries";
import { useAuth } from "../auth/AuthContext";
import "../App.css";

const api = getOsolotAPI();

export default function CollectiveDetail() {
  const { collectiveSlug } = useParams<{ collectiveSlug: string }>();
  const slug = collectiveSlug ?? "";
  const slugOk = isValidCollectiveSlug(slug);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [collective, setCollective] = useState<CollectiveDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [myMembership, setMyMembership] = useState<MembershipDetail | null>(
    null,
  );
  const [membershipLoading, setMembershipLoading] = useState(false);

  useEffect(() => {
    if (!slugOk) {
      setError("Invalid collective.");
      return;
    }
    const ac = new AbortController();
    (async () => {
      setError(null);
      setCollective(null);
      try {
        const c = await fetchCollective(slug, ac.signal);
        setCollective(c);
      } catch (e) {
        if (isAbortError(e)) return;
        setError("Collective not found or not accessible.");
      }
    })();
    return () => ac.abort();
  }, [slug, slugOk]);

  useEffect(() => {
    if (!user || !slugOk || collective === null) {
      setMyMembership(null);
      setMembershipLoading(false);
      return;
    }
    const viewerId = user.id;
    if (viewerId == null) {
      setMyMembership(null);
      setMembershipLoading(false);
      return;
    }
    const ac = new AbortController();
    setMembershipLoading(true);
    void (async () => {
      try {
        const m = await fetchMembership(slug, viewerId, ac.signal);
        setMyMembership(m);
      } catch {
        setMyMembership(null);
      } finally {
        if (!ac.signal.aborted) setMembershipLoading(false);
      }
    })();
    return () => ac.abort();
  }, [user, slug, slugOk, collective]);

  const isActiveMember = useMemo(() => {
    if (!user || !collective) return false;
    return collective.members.some(
      (m) => m.user.id === user.id && m.status === "active",
    );
  }, [user, collective]);

  const isPendingApplicant =
    myMembership?.summary.status === "pending" && !membershipLoading;

  const visibilityAllowsJoin =
    collective != null &&
    (collective.summary.visibility === "public" ||
      collective.summary.visibility === "unlisted" ||
      collective.summary.visibility === "private");

  const showJoin =
    collective != null &&
    !isActiveMember &&
    !isPendingApplicant &&
    visibilityAllowsJoin &&
    !(user && membershipLoading);

  const isAdmin = useMemo(() => {
    if (!user || !collective) return false;
    return collective.members.some(
      (m) => m.user.id === user.id && m.role === "admin",
    );
  }, [user, collective]);

  const canManageMembers = useMemo(() => {
    if (!user || !collective) return false;
    return collective.members.some(
      (m) =>
        m.user.id === user.id &&
        m.status === "active" &&
        (m.role === "admin" || m.role === "moderator"),
    );
  }, [user, collective]);

  function handleLeaveCollective() {
    if (!user || !collective || !slugOk) return;
    const viewerId = user.id;
    if (viewerId == null) return;
    const ok = window.confirm(
      "Leave this collective? You can join again later if the collective allows it.",
    );
    if (!ok) return;

    setLeaveError(null);
    setLeaving(true);
    void (async () => {
      try {
        await api.osolotServerApiCollectiveMembershipsDeleteMembership(slug, viewerId);
        navigate("/collectives", { replace: true });
      } catch {
        setLeaveError(
          "Could not leave. If you are the last admin, transfer the admin role first.",
        );
      } finally {
        setLeaving(false);
      }
    })();
  }

  function formatAppliedAt(iso: string | undefined | null) {
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

  return (
    <div className="page">
      <header className="header">
        <h1>Collective</h1>
        <div className="nav-links">
          {collective && isAdmin ? (
            <Link
              to={`/collectives/${collective.summary.slug}/edit`}
              className="btn secondary"
            >
              Edit collective
            </Link>
          ) : null}
          <Link to="/collectives" className="link">
            All collectives
          </Link>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {!error && collective === null ? <p className="muted">Loading…</p> : null}

      {collective ? (
        <>
          <section className="card">
            <h2>{collective.summary.name}</h2>
            {collective.summary.description ? (
              <p className="muted">{collective.summary.description}</p>
            ) : null}
            <dl className="kv collective-meta">
              <div>
                <dt>Visibility</dt>
                <dd>
                  {collective.summary.visibility === "public"
                    ? "Public"
                    : collective.summary.visibility === "unlisted" ||
                        collective.summary.visibility === "private"
                      ? "Unlisted"
                      : (collective.summary.visibility ?? "—")}
                </dd>
              </div>
              <div>
                <dt>Admission</dt>
                <dd>{collective.summary.admission_type ?? "—"}</dd>
              </div>
            </dl>
            {collective.application_question ? (
              <p className="muted">
                <strong>Application question:</strong>{" "}
                {collective.application_question}
              </p>
            ) : null}
            {leaveError ? <p className="error">{leaveError}</p> : null}
            {user && isPendingApplicant ? (
              <div className="pending-application">
                <h3 className="pending-application-title">
                  Application pending
                </h3>
                <p className="muted">
                  Your request to join is waiting for a moderator or admin.
                </p>
                <dl className="kv pending-application-meta">
                  <div>
                    <dt>Applied</dt>
                    <dd>{formatAppliedAt(myMembership?.applied_at)}</dd>
                  </div>
                </dl>
                {myMembership?.application_message ? (
                  <p className="pending-application-preview muted">
                    <strong>Your message:</strong> {myMembership.application_message}
                  </p>
                ) : null}
                <p className="collective-actions">
                  <Link
                    to={`/collectives/${collective.summary.slug}/join`}
                    className="btn secondary"
                  >
                    Edit application
                  </Link>
                </p>
              </div>
            ) : null}
            {showJoin ? (
              <p className="collective-actions">
                <Link
                  to={`/collectives/${collective.summary.slug}/join`}
                  className="btn"
                >
                  Join collective
                </Link>
              </p>
            ) : null}
            {isActiveMember && user ? (
              <p className="collective-actions">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={leaving}
                  onClick={handleLeaveCollective}
                >
                  {leaving ? "Leaving…" : "Leave collective"}
                </button>
              </p>
            ) : null}
          </section>

          <section className="card">
            <div className="member-section-header">
              <h2>Members</h2>
              {canManageMembers ? (
                <Link
                  to={`/collectives/${collective.summary.slug}/members/manage`}
                  className="btn secondary"
                >
                  Manage
                </Link>
              ) : null}
            </div>
            {collective.members.length === 0 ? (
              <p className="muted">No members listed.</p>
            ) : (
              <ul className="member-list">
                {collective.members.map((m) => (
                  <li key={`${m.user.id}-${m.collective.slug}`}>
                    <span className="member-name">
                      {m.user.first_name} {m.user.last_name}
                    </span>
                    <span className="member-meta">
                      {m.role} · {m.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
