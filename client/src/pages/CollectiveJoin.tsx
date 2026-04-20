import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CollectiveDetail } from "../api/generated";
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
  const [membershipChecked, setMembershipChecked] = useState(false);

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
      setMembershipChecked(true);
      return;
    }
    const viewerId = user.id;
    if (viewerId == null) {
      setPendingEdit(false);
      setMembershipChecked(true);
      return;
    }
    if (!collective) {
      setPendingEdit(false);
      setMembershipChecked(false);
      return;
    }
    const ac = new AbortController();
    setMembershipChecked(false);
    void (async () => {
      try {
        const m = await fetchMembership(slug, viewerId, ac.signal);
        if (m.summary.status === "pending") {
          setPendingEdit(true);
          setApplicationMessage(m.application_message ?? "");
        } else {
          navigate(backHref, { replace: true });
        }
      } catch {
        setPendingEdit(false);
      } finally {
        if (!ac.signal.aborted) setMembershipChecked(true);
      }
    })();
    return () => ac.abort();
  }, [collective, user, slug, slugOk, navigate, backHref]);

  const admissionIsApplication =
    collective?.summary.admission_type === "application";
  const showMessageField = admissionIsApplication || pendingEdit;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !slugOk) return;
    const viewerId = user.id;
    if (viewerId == null) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (pendingEdit) {
        await api.osolotServerApiCollectiveMembershipsUpdateMembership(slug, viewerId, {
          application_message: applicationMessage,
        });
      } else {
        await api.osolotServerApiCollectiveMembershipsJoinCollective(slug, {
          application_message: applicationMessage,
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
