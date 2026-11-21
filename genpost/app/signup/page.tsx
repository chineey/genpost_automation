"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import type { Currency } from "@/lib/geo";
import { AuthShell, FormError } from "@/components/AuthShell";

const PLAN_LABELS_USD: Record<string, string> = {
  starter: "Starter ($14)",
  growth: "Growth ($35)",
  agency: "Agency ($89)",
};

const PLAN_LABELS_NGN: Record<string, string> = {
  starter: "Starter (₦5,500)",
  growth: "Growth (₦11,000)",
  agency: "Agency (₦27,500)",
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
      const regRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, plan: selectedPlan }),
      });

      const regData = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regData.error ?? "Registration failed");
      }

      const loginRes = await signIn("credentials", { email, password, redirect: false });

      if (loginRes?.error) {
        setError(loginRes.error);
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      sub={selectedPlan === "free" ? "Start with 10 free posts — no card required." : `You selected: ${planLabels[selectedPlan] ?? selectedPlan}`}
    >
      <form className="space-y-4" onSubmit={handleSignup}>
        {error && <FormError>{error}</FormError>}
        <div>
          <label htmlFor="signup-email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="signup-email" required type="email" className="field" placeholder="you@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="signup-password" className="mb-1 block text-sm font-medium">Password</label>
          <input id="signup-password" required type="password" className="field" placeholder="Min. 8 characters" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Region detected: <b className="text-foreground">{currency === "ngn" ? "Nigeria / Africa · NGN" : "International · USD"}</b>
        </div>
        <button id="signup-submit" type="submit" disabled={loading} className="btn btn-loud w-full py-3">
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="font-semibold text-primary">Log in</Link>
      </p>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SignupForm />
    </Suspense>
  );
}
