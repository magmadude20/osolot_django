import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getOsolotAPI } from "../api/generated";
import "../App.css";

const api = getOsolotAPI();

export default function ResetPassword() {
  const [params] = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!uid || !token) {
      setError("Invalid reset link. Request a new one from the login page.");
      return;
    }
    try {
      const res = await api.osolotServerApiAuthRoutesPasswordResetConfirm({
        uid,
        token,
        new_password: password,
      });
      setMessage(res.message);
    } catch {
      setError("Invalid or expired link. Please request a new reset email.");
    }
  }

  if (message) {
    return (
      <div className="page">
        <p className="muted">{message}</p>
        <p>
          <Link to="/" className="btn">
            Log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Choose a new password</h1>
        <Link to="/" className="link">
          Back to login
        </Link>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <form onSubmit={onSubmit} className="card form">
        <label>
          New password (min 8 characters)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
        </label>
        <button type="submit" className="btn">
          Update password
        </button>
      </form>
    </div>
  );
}
