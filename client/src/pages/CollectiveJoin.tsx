import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  CollectiveDetail,
  MembershipDetail,
  PostSummary,
} from "../api/generated";
import {
  fetchCollective,
  fetchMembership,
  isAbortError,
  isValidCollectiveSlug,
} from "../api/collectives-queries";
import { getOsolotAPI } from "../api/generated";
import { useAuth } from "../auth/AuthContext";
import "../App.css";

const api = getOsolotAPI();

export default function CollectiveJoin() {
  const { collectiveSlug } = useParams<{ collectiveSlug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const slug = collectiveSlug ?? "";
  const slugOk = isValidCollectiveSlug(slug);
  const backHref = slugOk ? `/collectives/${slug}` : "/collectives";

  const [collective, setCollective] = useState<CollectiveDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingEdit, setPendingEdit] = useState(false);
  const [pendingMembership, setPendingMembership] =
    useState<MembershipDetail | null>(null);
  const [membershipChecked, setMembershipChecked] = useState(false);

  const [myPosts, setMyPosts] = useState<PostSummary[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedSharedSlugs, setSelectedSharedSlugs] = useState<string[]>([]);

  const selectedSlugSet = useMemo(
    () => new Set(selectedSharedSlugs),
    [selectedSharedSlugs],
  );

  function toggleSharedPost(slug: string) {
    setSelectedSharedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  useEffect(() => {
    if (!slugOk) {
      setLoadError("Invalid collective.");
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        const c = await fetchCollective(slug, ac.signal);
        setCollective(c);
      } catch (e) {
        if (isAbortError(e)) return;
        setLoadError("Collective not found or not accessible.");
      }
    })();
    return () => ac.abort();
  }, [slug, slugOk]);

  useEffect(() => {
    if (!slugOk) return;
    if (!user) {
      setPendingEdit(false);
      setPendingMembership(null);
      setMembershipChecked(true);
      return;
    }
    const viewerUsername = user.username;
    if (!viewerUsername) {
      setPendingEdit(false);
      setPendingMembership(null);
      setMembershipChecked(true);
      return;
    }
    if (!collective) {
      setPendingEdit(false);
      setPendingMembership(null);
      setMembershipChecked(false);
      return;
    }
    const ac = new AbortController();
    setMembershipChecked(false);
    void (async () => {
      try {
        const m = await fetchMembership(slug, viewerUsername, ac.signal);
        if (m.summary.status === "pending") {
          setPendingEdit(true);
          setPendingMembership(m);
          setApplicationMessage(m.application_message ?? "");
        } else {
          setPendingMembership(null);
          navigate(backHref, { replace: true });
        }
      } catch {
        setPendingEdit(false);
        setPendingMembership(null);
      } finally {
        if (!ac.signal.aborted) setMembershipChecked(true);
      }
    })();
    return () => ac.abort();
  }, [collective, user, slug, slugOk, navigate, backHref]);

  useEffect(() => {
    if (!user || !collective || !membershipChecked || !slugOk) return;

    let cancelled = false;
    setPostsLoading(true);
    void api
      .osolotServerApiPostsListMyPosts()
      .then((posts) => {
        if (cancelled) return;
        setMyPosts(posts);
        if (pendingEdit && pendingMembership) {
          const slugs = (pendingMembership.shared_posts ?? [])
            .map((p) => p.slug)
            .filter((s): s is string => Boolean(s));
          setSelectedSharedSlugs(slugs);
        } else if (!pendingEdit) {
          const slugs = posts
            .filter(
              (p) => p.sharing?.share_with_new_collectives_default === true,
            )
            .map((p) => p.slug)
            .filter((s): s is string => Boolean(s));
          setSelectedSharedSlugs(slugs);
        }
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    user,
    collective,
    membershipChecked,
    slugOk,
    pendingEdit,
    pendingMembership,
  ]);

  const admissionIsApplication =
    collective?.summary.admission_type === "application";
  const showMessageField = admissionIsApplication || pendingEdit;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !slugOk) return;
    const viewerUsername = user.username;
    if (!viewerUsername) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (pendingEdit) {
        await api.osolotServerApiCollectiveMembershipsUpdateMembership(
          slug,
          viewerUsername,
          {
            application_message: applicationMessage,
            shared_post_slugs: selectedSharedSlugs,
          },
        );
      } else {
        await api.osolotServerApiCollectiveMembershipsJoinCollective(slug, {
          application_message: applicationMessage,
          shared_post_slugs: selectedSharedSlugs,
        });
      }
      navigate(backHref, { replace: true });
    } catch {
      setSubmitError(
        pendingEdit
          ? "Could not update your application. Try again or log in."
          : "Could not join. You may already be a member, have a pending application, or need to log in again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (loadError || !slugOk) {
    return (
      <div className="page">
        <p className="error">{loadError ?? "Invalid collective."}</p>
        <p>
          <Link to="/collectives" className="link">
            All collectives
          </Link>
        </p>
      </div>
    );
  }

  if (!collective) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (user && !membershipChecked) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <h1>
          {pendingEdit
            ? `Update application · ${collective.summary.name}`
            : `Join ${collective.summary.name}`}
        </h1>
        <Link to={backHref} className="link">
          Go back
        </Link>
      </header>

      <section className="card join-disclaimer">
        <p className="muted join-disclaimer-text">
          Other members of this collective will be able to see your first and last
          name as they appear on your profile once you join.
        </p>
      </section>

      {admissionIsApplication && collective.application_question ? (
        <p className="muted">
          <strong>They ask:</strong> {collective.application_question}
        </p>
      ) : null}

      {!user ? (
        <>
          <p className="muted">Log in to join this collective.</p>
          <p className="nav-links">
            <Link to="/login" state={{ from: backHref }} className="btn">
              Log in
            </Link>
            <Link to={backHref} className="btn secondary">
              Cancel
            </Link>
            <Link to="/collectives" className="link">
              All collectives
            </Link>
          </p>
        </>
      ) : (
        <form onSubmit={onSubmit} className="card form">
          {submitError ? <p className="error">{submitError}</p> : null}
          {showMessageField ? (
            <label>
              Your message (optional)
              <textarea
                value={applicationMessage}
                onChange={(e) => setApplicationMessage(e.target.value)}
                rows={4}
                maxLength={100_000}
                placeholder="Introduce yourself or answer the question above"
              />
            </label>
          ) : null}

          <fieldset className="fieldset">
            <legend>Posts shared with this collective</legend>
            <p className="muted small">
              Choose which of your posts members can see through this membership.
              Defaults follow each post’s “share with new collectives” setting.
            </p>
            {postsLoading ? (
              <p className="muted">Loading your posts…</p>
            ) : myPosts.length === 0 ? (
              <p className="muted">You have no posts yet.</p>
            ) : (
              <div className="collective-pick-list">
                {myPosts.map((p) => {
                  const postSlug = p.slug ?? "";
                  if (!postSlug) return null;
                  return (
                    <label key={postSlug} className="checkbox">
                      <input
                        type="checkbox"
                        checked={selectedSlugSet.has(postSlug)}
                        onChange={() => toggleSharedPost(postSlug)}
                      />
                      <span className="badge">{p.type ?? "offer"}</span>
                      <span>{p.title}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div className="nav-links">
            <button type="submit" className="btn" disabled={submitting}>
              {submitting
                ? pendingEdit
                  ? "Saving…"
                  : "Joining…"
                : pendingEdit
                  ? "Save changes"
                  : "Join collective"}
            </button>
            <Link to={backHref} className="btn secondary">
              Cancel
            </Link>
            <Link to="/collectives" className="link">
              All collectives
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
