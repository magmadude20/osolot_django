import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CollectiveDetail } from "../api/generated";
import {
  fetchCollective,
  isAbortError,
  isValidCollectiveSlug,
} from "../api/collectives-queries";
import { getOsolotAPI } from "../api/generated";
import { useAuth } from "../auth/AuthContext";
import "../App.css";

const api = getOsolotAPI();

export default function CollectiveEdit() {
  const { collectiveSlug } = useParams<{ collectiveSlug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const slug = collectiveSlug ?? "";
  const slugOk = isValidCollectiveSlug(slug);

  const [collective, setCollective] = useState<CollectiveDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("unlisted");
  const [admissionType, setAdmissionType] = useState("open");
  const [applicationQuestion, setApplicationQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        setName(c.summary.name);
        setDescription(c.summary.description ?? "");
        setVisibility(
          c.summary.visibility === "private" || !c.summary.visibility
            ? "unlisted"
            : c.summary.visibility,
        );
        setAdmissionType(c.summary.admission_type ?? "open");
        setApplicationQuestion(c.application_question);
      } catch (e) {
        if (isAbortError(e)) return;
        setLoadError("Collective not found or not accessible.");
      }
    })();
    return () => ac.abort();
  }, [slug, slugOk]);

  const isAdmin = useMemo(() => {
    if (!user || !collective) return false;
    return collective.members.some(
      (m) => m.user.id === user.id && m.role === "admin",
    );
  }, [user, collective]);

  const detailHref = `/collectives/${slug}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !slugOk) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.osolotServerApiCollectivesUpdateCollective(slug, {
        name: name.trim(),
        description,
        visibility,
        admission_type: admissionType,
        application_question: applicationQuestion,
      });
      navigate(detailHref, { replace: true });
    } catch {
      setError("Could not save changes. Check your connection and permissions.");
    } finally {
      setSubmitting(false);
    }
  }

  function onDeleteClick() {
    if (!slugOk || !collective) return;
    const label = collective.summary.name;
    const ok = window.confirm(
      `Delete “${label}”? This permanently removes the collective and cannot be undone.`,
    );
    if (!ok) return;

    setError(null);
    setDeleting(true);
    void (async () => {
      try {
        await api.osolotServerApiCollectivesDeleteCollective(slug);
        navigate("/collectives", { replace: true });
      } catch {
        setError("Could not delete the collective.");
      } finally {
        setDeleting(false);
      }
    })();
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
        <header className="header">
          <h1>Edit collective</h1>
          <Link to={slugOk ? detailHref : "/collectives"} className="link">
            Back
          </Link>
        </header>
        <p className="muted">Log in to edit this collective.</p>
        <Link to="/login" state={{ from: slugOk ? `/collectives/${slug}/edit` : "/collectives" }} className="btn">
          Log in
        </Link>
      </div>
    );
  }

  if (loadError || !slugOk) {
    return (
      <div className="page">
        <p className="error">{loadError ?? "Invalid collective."}</p>
        <Link to="/collectives" className="link">
          All collectives
        </Link>
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

  if (!isAdmin) {
    return (
      <div className="page">
        <header className="header">
          <h1>Edit collective</h1>
          <Link to={detailHref} className="link">
            Back
          </Link>
        </header>
        <p className="error">You don’t have permission to edit this collective.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Edit collective</h1>
        <Link to={detailHref} className="link">
          Cancel
        </Link>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <form onSubmit={onSubmit} className="card form">
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={1}
            maxLength={255}
            autoComplete="off"
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={100_000}
          />
        </label>
        <label>
          Visibility
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="unlisted">Unlisted (not in directory; join with link)</option>
            <option value="public">Public (listed for everyone)</option>
          </select>
        </label>
        <label>
          Admission
          <select
            value={admissionType}
            onChange={(e) => setAdmissionType(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="application">Application required</option>
          </select>
        </label>
        <label>
          Application question (optional)
          <textarea
            value={applicationQuestion}
            onChange={(e) => setApplicationQuestion(e.target.value)}
            rows={3}
            maxLength={100_000}
            placeholder="Shown when admission is application-based"
          />
        </label>
        <button type="submit" className="btn" disabled={submitting || deleting}>
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </form>

      <section className="card danger-zone">
        <h2>Danger zone</h2>
        <p className="muted">
          Deleting removes this collective for everyone. This action cannot be undone.
        </p>
        <button
          type="button"
          className="btn btn-danger"
          disabled={deleting || submitting}
          onClick={onDeleteClick}
        >
          {deleting ? "Deleting…" : "Delete collective"}
        </button>
      </section>
    </div>
  );
}
