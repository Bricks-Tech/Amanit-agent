import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { loginRequest } from "../api";
import { useAuth } from "../auth";

export function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await loginRequest(email, password);
      login(result.token, result.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-root">
      <div className="login-layout">
        <section className="login-brand">
          <img
            className="brand-logo"
            src="/assets/amanit-logo.png"
            alt="Amanit"
            width={104}
            height={104}
          />
          <h1>Voice Agent Admin</h1>
          <p className="location">Amanit Sitges, Barcelona</p>
          <p className="lede">
            Review the conversations and orders handled by your voice agent.
          </p>
          <ul>
            <li>Listen to recordings and read transcripts</li>
            <li>Follow every table’s order to Lightspeed</li>
            <li>Check today’s conversations and order value</li>
          </ul>
        </section>

        <section className="login-card">
          <h2>Log in</h2>
          <p className="hint">Enter your email and password to access your account</p>
          <form className="login-form" onSubmit={onSubmit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <div className="field-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  className={showPassword ? "plain" : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="eye-btn"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  <img src="/assets/eye-icon.svg" alt="" width={18} height={18} />
                </button>
              </div>
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Log in"}
            </button>
          </form>
          <p className="invite-note">Registration is by invitation only.</p>
          <p className="invite-note">
            <a href="/voice" style={{ color: "#26837d" }}>
              Open voice concierge page
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
