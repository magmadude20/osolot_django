import { type FormEvent, useEffect, useState } from "react";
import { type AxiosError } from "axios";
import { Link } from "react-router-dom";
import { getOsolotAPI } from "../api/generated";
import { useAuth } from "../auth/AuthContext";
import "../App.css";

const api = getOsolotAPI();

export default function Home() {
  const { user, loading, logout, updateProfile } = useAuth();
  const [editUsername, setEditUsername] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verificationSending, setVerificationSending] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (user) {
      setEditUsername(user.username);
      setEditFirstName(user.first_name ?? "");
      setEditLastName(user.last_name ?? "");
      setEditBio(user.bio ?? "");
    }
  }, [user]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    try {
      await updateProfile({
        username: editUsername.trim(),
        first_name: editFirstName,
        last_name: editLastName,
        bio: editBio,
      });
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>;
      const detail = ax.response?.data?.detail;
      setError(
        typeof detail === "string" ? detail : "Could not update profile.",
      );
    }
  }

  async function handleSendVerificationEmail() {
    if (!user?.email) return;
    setError(null);
    setVerificationMessage(null);
    setVerificationSending(true);
    try {
      const res = await api.osolotServerApiAuthEmailVerificationRequest({
        email: user.email,
      });
      setVerificationMessage(res.message);
    } catch {
      setError("Could not send verification email.");
    } finally {
      setVerificationSending(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Osolot</h1>
        <nav className="nav-links">
          <Link to="/collectives" className="link">
            Collectives
          </Link>
          {user ? (
            <button type="button" className="btn secondary" onClick={logout}>
              Log out
            </button>
          ) : (
            <Link to="/login" className="btn">
              Log in
            </Link>
          )}
        </nav>
      </header>

      <p className="muted">
        Browse public collectives or sign in to manage your account.
      </p>

      {user ? (
        <section className="card">
          <h2>Account</h2>
          {error ? <p className="error">{error}</p> : null}
          <dl className="kv">
            <div>
              <dt>Email</dt>
              <dd>{user.email || "—"}</dd>
            </div>
          </dl>

          <div className="verification-block">
            {user.email_verified ? (
              <p className="verification-text verified">your email is verified!</p>
            ) : (
              <>
                <p className="verification-text">email verification needed</p>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={verificationSending}
                  onClick={() => void handleSendVerificationEmail()}
                >
                  {verificationSending ? "Sending…" : "Send verification email"}
                </button>
                {verificationMessage ? (
                  <p className="muted verification-followup">{verificationMessage}</p>
                ) : null}
              </>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="form">
            <label>
              Username (3–31 characters: letters, digits, _ . -)
              <input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={3}
                maxLength={31}
              />
            </label>
            <label>
              First name
              <input
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </label>
            <label>
              Last name
              <input
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                autoComplete="family-name"
              />
            </label>
            <label>
              Bio
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={10_000}
                rows={5}
                placeholder="A few words about you"
              />
            </label>
            <button type="submit" className="btn">
              Save profile
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
