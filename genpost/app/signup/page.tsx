"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense } from "react";

import { useEffect } from "react";
import type { Currency } from "@/lib/geo";

const PLAN_LABELS_USD: Record<string, string> = {
  starter: "Starter ($14/mo)",
  growth: "Growth ($35/mo)",
  agency: "Agency ($89/mo)",
};

const PLAN_LABELS_NGN: Record<string, string> = {
  starter: "Starter (₦5,500/mo)",
  growth: "Growth (₦11,000/mo)",
  agency: "Agency (₦27,500/mo)",
};

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPlan = searchParams.get("plan") ?? "free";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState<Currency>("usd");

  useEffect(() => {
    fetch("/api/detect-region")
      .then((r) => r.json())
      .then((data) => {
        if (data.currency) setCurrency(data.currency);
      })
      .catch(() => {});
  }, []);

  const planLabels = currency === "ngn" ? PLAN_LABELS_NGN : PLAN_LABELS_USD;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    try {
      // 1. Create account via backend route
      const regRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, plan: selectedPlan }),
      });

      const regData = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regData.error ?? "Registration failed");
      }

      // 2. Automatically log in the user
      const loginRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (loginRes?.error) {
        setError(loginRes.error);
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      setError(msg);
      setLoading(false);
    }
  }


  return (
    <>
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

        <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: 24, marginBottom: 8 }}>
          Create your account
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          {selectedPlan === "free"
            ? "Start with 10 free posts — no card required"
            : `You selected: ${planLabels[selectedPlan] ?? selectedPlan}`}
        </p>
      </div>

      <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          <label className="label" htmlFor="signup-email">Email address</label>
          <input
            id="signup-email"
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
          <label className="label" htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            className="input"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        <button
          id="signup-submit"
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ width: "100%", justifyContent: "center", padding: "14px", marginTop: 8 }}
        >
          {loading ? <span className="spinner" /> : "Create Account →"}
        </button>

        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem", lineHeight: 1.5 }}>
          By signing up you agree to our{" "}
          <Link href="/terms" style={{ color: "var(--text-secondary)", textDecoration: "underline" }}>Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" style={{ color: "var(--text-secondary)", textDecoration: "underline" }}>Privacy Policy</Link>.
        </p>
      </form>

      <div className="divider" style={{ margin: "24px 0" }} />

      <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--brand-orange-light)", fontWeight: 500, textDecoration: "none" }}>
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function SignupPage() {
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
      <div className="orb orb-orange" style={{ width: 500, height: 500, top: -100, left: -100 }} />
      <div className="orb orb-amber" style={{ width: 400, height: 400, bottom: -100, right: -100 }} />
      <div className="grid-pattern" style={{ position: "absolute", inset: 0, opacity: 0.4 }} />

      <div
        className="card glass animate-fade-up"
        style={{ width: "100%", maxWidth: 420, padding: 40, position: "relative", zIndex: 1 }}
      >
        <Suspense fallback={<div className="skeleton" style={{ height: 400 }} />}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
