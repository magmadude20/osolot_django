import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getOsolotAPI } from "../api/generated";
import { useAuth } from "../auth/AuthContext";
import "../App.css";

const api = getOsolotAPI();

export default function CollectiveNew() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("unlisted");
  const [admissionType, setAdmissionType] = useState("open");
  const [applicationQuestion, setApplicationQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.osolotServerApiCollectivesCreateCollective({
        name: name.trim(),
        description,
        visibility,
        admission_type: admissionType,
        application_question: applicationQuestion,
      });
      navigate(`/collectives/${created.summary.slug}`, { replace: true });
    } catch {
      setError(
        "Could not create collective. You may need to log in, or check the fields.",
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

  if (!user) {
    return (
      <div className="page">
        <header className="header">
          <h1>New collective</h1>
          <Link to="/collectives" className="link">
            Back
          </Link>
        </header>
        <p className="muted">Log in to create a collective.</p>
        <p>
          <Link to="/login" className="btn">
            Log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <h1>New collective</h1>
        <Link to="/collectives" className="link">
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
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? "Creating…" : "Create collective"}
        </button>
      </form>
    </div>
  );
}
