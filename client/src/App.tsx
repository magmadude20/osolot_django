import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./App.css";
import { clearTokens, getAccessToken, setTokens } from "./api/axios-instance";
import { getOsolotAPI, type UserOut } from "./api/generated";

const api = getOsolotAPI();

function App() {
  const [panel, setPanel] = useState<"login" | "register">("login");
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const [regPass, setRegPass] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");

  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");

  const [verificationSending, setVerificationSending] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );

  const bootstrap = useCallback(async () => {
    setError(null);
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.osolotServerApiUserRoutesMe();
      setUser(me);
      setEditFirstName(me.first_name);
      setEditLastName(me.last_name);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const tokens = await api.osolotServerApiAuthRoutesLogin({
        email: loginEmail,
        password: loginPass,
      });
      setTokens(tokens.access, tokens.refresh);
      await bootstrap();
    } catch {
      setError("Login failed. Check email and password.");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const tokens = await api.osolotServerApiAuthRoutesRegister({
        password: regPass,
        email: regEmail,
        first_name: regFirstName || undefined,
        last_name: regLastName || undefined,
      });
      setTokens(tokens.access, tokens.refresh);
      await bootstrap();
    } catch {
      setError("Registration failed. That email may already be registered.");
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    try {
      const updated = await api.osolotServerApiUserRoutesUpdateMe({
        first_name: editFirstName,
        last_name: editLastName,
      });
      setUser(updated);
    } catch {
      setError("Could not update profile.");
    }
  }

  async function handleSendVerificationEmail() {
    if (!user?.email) return;
    setError(null);
    setVerificationMessage(null);
    setVerificationSending(true);
    try {
      const res = await api.osolotServerApiAuthRoutesEmailVerificationRequest({
        email: user.email,
      });
      setVerificationMessage(res.message);
    } catch {
      setError("Could not send verification email.");
    } finally {
      setVerificationSending(false);
    }
  }

  function handleLogout() {
    clearTokens();
    setUser(null);
    setLoading(false);
    setLoginEmail("");
    setLoginPass("");
    setVerificationMessage(null);
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="page">
        <header className="header">
          <h1>Account</h1>
          <button type="button" className="btn secondary" onClick={handleLogout}>
            Log out
          </button>
        </header>

        {error ? <p className="error">{error}</p> : null}

        <section className="card">
          <h2>Profile</h2>
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
            <button type="submit" className="btn">
              Save profile
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Osolot</h1>
      </header>

      <div className="tabs">
        <button
          type="button"
          className={panel === "login" ? "tab active" : "tab"}
          onClick={() => {
            setPanel("login");
            setError(null);
          }}
        >
          Log in
        </button>
        <button
          type="button"
          className={panel === "register" ? "tab active" : "tab"}
          onClick={() => {
            setPanel("register");
            setError(null);
          }}
        >
          Register
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {panel === "login" ? (
        <form onSubmit={handleLogin} className="card form">
          <label>
            Email
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <p className="form-meta">
            <Link to="/forgot-password" className="link">
              Forgot password?
            </Link>
          </p>
          <button type="submit" className="btn">
            Log in
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="card form">
          <label>
            Email
            <input
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password (min 8 characters)
            <input
              type="password"
              value={regPass}
              onChange={(e) => setRegPass(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          <label>
            First name (optional)
            <input
              value={regFirstName}
              onChange={(e) => setRegFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </label>
          <label>
            Last name (optional)
            <input
              value={regLastName}
              onChange={(e) => setRegLastName(e.target.value)}
              autoComplete="family-name"
            />
          </label>
          <button type="submit" className="btn">
            Create account
          </button>
        </form>
      )}
    </div>
  );
}

export default App;
