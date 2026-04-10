import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { getOsolotAPI } from "../api/generated";
import "../App.css";

const api = getOsolotAPI();

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.osolotServerApiAuthRoutesPasswordResetRequest({
        email,
      });
      setMessage(res.message);
    } catch {
      setError("Something went wrong. Try again.");
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Reset password</h1>
        <Link to="/" className="link">
          Back to login
        </Link>
      </header>

      {message ? <p className="muted">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!message ? (
        <form onSubmit={onSubmit} className="card form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <button type="submit" className="btn">
            Send reset link
          </button>
        </form>
      ) : null}
    </div>
  );
}
