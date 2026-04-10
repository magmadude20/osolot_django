import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getOsolotAPI } from "../api/generated";
import "../App.css";

const api = getOsolotAPI();

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";

  const [phase, setPhase] = useState<"loading" | "success" | "error">(() =>
    uid && token ? "loading" : "error",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() =>
    uid && token
      ? null
      : "Invalid verification link. Open the link from your email, or request a new one from your account.",
  );

  useEffect(() => {
    if (!uid || !token) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.osolotServerApiAuthRoutesEmailVerificationConfirm({
          uid,
          token,
        });
        if (!cancelled) {
          setMessage(res.message);
          setPhase("success");
        }
      } catch {
        if (!cancelled) {
          setError(
            "Invalid or expired link. Request a new verification email from your account.",
          );
          setPhase("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  if (phase === "loading") {
    return (
      <div className="page">
        <p className="muted">Verifying your email…</p>
      </div>
    );
  }

  if (phase === "success" && message) {
    return (
      <div className="page">
        <p className="muted">{message}</p>
        <p>
          <Link to="/" className="btn">
            Continue
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Email verification</h1>
        <Link to="/" className="link">
          Home
        </Link>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <p>
        <Link to="/" className="btn">
          Back to account
        </Link>
      </p>
    </div>
  );
}
