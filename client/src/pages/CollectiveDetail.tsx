import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getOsolotAPI,
  PostType,
  type CollectiveDetail,
  type MembershipDetail,
  type PostSummary,
} from "../api/generated";
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

  const sharingDialogRef = useRef<HTMLDialogElement>(null);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [sharingMyPosts, setSharingMyPosts] = useState<PostSummary[]>([]);
  const [sharingPostsLoading, setSharingPostsLoading] = useState(false);
  const [sharingLoadError, setSharingLoadError] = useState<string | null>(null);
  const [sharingSelectedSlugs, setSharingSelectedSlugs] = useState<string[]>([]);
  const [sharingSaveError, setSharingSaveError] = useState<string | null>(null);
  const [sharingSaving, setSharingSaving] = useState(false);

  const sharingSelectedSet = useMemo(
    () => new Set(sharingSelectedSlugs),
    [sharingSelectedSlugs],
  );

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
    const viewerUsername = user.username;
    if (!viewerUsername) {
      setMyMembership(null);
      setMembershipLoading(false);
      return;
    }
    const ac = new AbortController();
    setMembershipLoading(true);
    void (async () => {
      try {
        const m = await fetchMembership(slug, viewerUsername, ac.signal);
        setMyMembership(m);
      } catch {
        setMyMembership(null);
      } finally {
        if (!ac.signal.aborted) setMembershipLoading(false);
      }
    })();
    return () => ac.abort();
  }, [user, slug, slugOk, collective]);

  useEffect(() => {
    const el = sharingDialogRef.current;
    if (!el) return;
    if (sharingModalOpen) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [sharingModalOpen]);

  useEffect(() => {
    if (!sharingModalOpen || !user || !slugOk) return;
    const uname = user.username;
    if (!uname) return;

    let cancelled = false;
    setSharingPostsLoading(true);
    setSharingLoadError(null);
    void (async () => {
      try {
        const [posts, m] = await Promise.all([
          api.osolotServerApiPostsListMyPosts(),
          api.osolotServerApiCollectiveMembershipsGetMembership(slug, uname),
        ]);
        if (cancelled) return;
        setSharingMyPosts(posts);
        setMyMembership(m);
        const selected = (m.shared_posts ?? [])
          .map((p) => p.slug)
          .filter((s): s is string => Boolean(s));
        setSharingSelectedSlugs(selected);
      } catch {
        if (!cancelled) {
          setSharingLoadError("Could not load your posts or membership.");
        }
      } finally {
        if (!cancelled) setSharingPostsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sharingModalOpen, user, slug, slugOk]);

  const isActiveMember = useMemo(() => {
    if (!user || !collective) return false;
    return collective.members.some(
      (m) => m.user.username === user.username && m.status === "active",
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
      (m) => m.user.username === user.username && m.role === "admin",
    );
  }, [user, collective]);

  const canManageMembers = useMemo(() => {
    if (!user || !collective) return false;
    return collective.members.some(
      (m) =>
        m.user.username === user.username &&
        m.status === "active" &&
        (m.role === "admin" || m.role === "moderator"),
    );
  }, [user, collective]);

  function handleLeaveCollective() {
    if (!user || !collective || !slugOk) return;
    const viewerUsername = user.username;
    if (!viewerUsername) return;
    const ok = window.confirm(
      "Leave this collective? You can join again later if the collective allows it.",
    );
    if (!ok) return;

    setLeaveError(null);
    setLeaving(true);
    void (async () => {
      try {
        await api.osolotServerApiCollectiveMembershipsDeleteMembership(
          slug,
          viewerUsername,
        );
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

  function toggleSharingSlug(postSlug: string) {
    setSharingSelectedSlugs((prev) =>
      prev.includes(postSlug)
        ? prev.filter((s) => s !== postSlug)
        : [...prev, postSlug],
    );
  }

  function closeSharingModal() {
    setSharingModalOpen(false);
    setSharingSaveError(null);
    setSharingLoadError(null);
  }

  async function saveSharing(e: FormEvent) {
    e.preventDefault();
    if (!user || !slugOk) return;
    const uname = user.username;
    if (!uname) return;
    setSharingSaveError(null);
    setSharingSaving(true);
    try {
      const m = await api.osolotServerApiCollectiveMembershipsUpdateMembership(
        slug,
        uname,
        { shared_post_slugs: sharingSelectedSlugs },
      );
      setMyMembership(m);
      closeSharingModal();
    } catch {
      setSharingSaveError("Could not update sharing. Try again.");
    } finally {
      setSharingSaving(false);
    }
  }

  function memberDisplayName(u: PostSummary["owner"]) {
    const parts = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    return parts || u.username;
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
            <h2>Shared posts</h2>
            <p className="muted small">
              Offers and requests members have shared with this collective.
            </p>
            {(collective.shared_posts ?? []).length === 0 ? (
              <p className="muted">No shared posts yet.</p>
            ) : (
              <ul className="shared-posts-list collective-shared-posts-list">
                {(collective.shared_posts ?? []).map((p) => {
                  const postSlug = p.slug ?? "";
                  return (
                    <li key={postSlug || p.title}>
                      <div className="collective-shared-post-line">
                        <span className="badge">{p.type ?? PostType.offer}</span>
                        {postSlug ? (
                          <Link
                            to={`/posts/browse/${encodeURIComponent(postSlug)}`}
                            className="collective-shared-post-title"
                          >
                            {p.title}
                          </Link>
                        ) : (
                          <span>{p.title}</span>
                        )}
                      </div>
                      <div className="muted small collective-shared-post-by">
                        <Link
                          to={`/users/${encodeURIComponent(p.owner.username)}`}
                          state={{
                            fromCollectiveSlug: collective.summary.slug,
                          }}
                          className="link"
                        >
                          {memberDisplayName(p.owner)}
                        </Link>
                        <span> · @{p.owner.username}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {(isActiveMember || isPendingApplicant) &&
          user &&
          myMembership &&
          !membershipLoading ? (
            <section className="card">
              <div className="member-section-header">
                <h2>Your posts in this collective</h2>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setSharingSaveError(null);
                    setSharingModalOpen(true);
                  }}
                >
                  Edit sharing
                </button>
              </div>
              <p className="muted small">
                Members can only see posts you explicitly share through this
                membership.
              </p>
              {!myMembership.shared_posts ||
              myMembership.shared_posts.length === 0 ? (
                <p className="muted">
                  You are not sharing any posts with this collective yet.
                </p>
              ) : (
                <ul className="shared-posts-list">
                  {myMembership.shared_posts.map((p) => {
                    const ps = p.slug ?? "";
                    return (
                      <li key={ps || p.title}>
                        <span className="badge">{p.type ?? PostType.offer}</span>
                        {ps ? (
                          <Link to={`/posts/${ps}/edit`}>{p.title}</Link>
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
                {collective.members.map((m) => {
                  const name =
                    [m.user.first_name, m.user.last_name]
                      .filter(Boolean)
                      .join(" ")
                      .trim() || m.user.username;
                  return (
                    <li key={`${m.user.username}-${m.collective.slug}`}>
                      <Link
                        to={`/users/${encodeURIComponent(m.user.username)}`}
                        state={{
                          fromCollectiveSlug: collective.summary.slug,
                        }}
                        className="member-name member-name-link"
                      >
                        {name}
                      </Link>
                      <span className="member-meta">
                        {m.role} · {m.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <dialog
            ref={sharingDialogRef}
            className="modal-dialog"
            aria-labelledby="sharing-dialog-title"
            onClose={closeSharingModal}
          >
            <form className="modal-dialog-form" onSubmit={(e) => void saveSharing(e)}>
              <div className="modal-dialog-header">
                <h2 id="sharing-dialog-title">Edit post sharing</h2>
                <button
                  type="button"
                  className="modal-dialog-close as-button"
                  aria-label="Close"
                  onClick={closeSharingModal}
                >
                  ×
                </button>
              </div>
              <div className="modal-dialog-body">
                <p className="muted small">
                  Checked posts are visible to members of this collective through
                  your membership.
                </p>
                {sharingLoadError ? (
                  <p className="error">{sharingLoadError}</p>
                ) : null}
                {sharingSaveError ? (
                  <p className="error">{sharingSaveError}</p>
                ) : null}
                {sharingPostsLoading ? (
                  <p className="muted">Loading…</p>
                ) : sharingMyPosts.length === 0 ? (
                  <p className="muted">You have no posts yet.</p>
                ) : (
                  <div className="collective-pick-list">
                    {sharingMyPosts.map((p) => {
                      const postSlug = p.slug ?? "";
                      if (!postSlug) return null;
                      return (
                        <label key={postSlug} className="checkbox">
                          <input
                            type="checkbox"
                            checked={sharingSelectedSet.has(postSlug)}
                            onChange={() => toggleSharingSlug(postSlug)}
                          />
                          <span className="badge">
                            {p.type ?? PostType.offer}
                          </span>
                          <span>{p.title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={sharingSaving || sharingPostsLoading}
                  onClick={closeSharingModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={
                    sharingSaving ||
                    sharingPostsLoading ||
                    Boolean(sharingLoadError)
                  }
                >
                  {sharingSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </dialog>
        </>
      ) : null}
    </div>
  );
}
