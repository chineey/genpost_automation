"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }


  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background */}
      <div className="orb orb-orange" style={{ width: 500, height: 500, top: -100, right: -100 }} />
      <div className="orb orb-purple" style={{ width: 400, height: 400, bottom: -100, left: -100 }} />
      <div className="grid-pattern" style={{ position: "absolute", inset: 0, opacity: 0.4 }} />

      <div
        className="card glass animate-fade-up"
        style={{ width: "100%", maxWidth: 420, padding: 40, position: "relative", zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, #FF6B2B, #FFAA00)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              ⚡
            </div>
            <span className="font-display" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Genpost
            </span>
          </Link>
          <h1
            className="font-display"
            style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: 24, marginBottom: 8 }}
          >
            Welcome back
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Sign in to your Genpost account
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#F87171",
                fontSize: "0.85rem",
              }}
            >
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="label" htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", padding: "14px", marginTop: 8 }}
          >
            {loading ? <span className="spinner" /> : "Sign In"}
          </button>
        </form>

        <div className="divider" style={{ margin: "24px 0" }} />

        <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "var(--brand-orange-light)", fontWeight: 500, textDecoration: "none" }}>
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
