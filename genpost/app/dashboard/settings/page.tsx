"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import type { Currency } from "@/lib/geo";

const USD_PLANS = [
  { key: "starter", name: "Starter", price: "$14/mo", posts: 30 },
  { key: "growth", name: "Growth", price: "$35/mo", posts: 100 },
  { key: "agency", name: "Agency", price: "$89/mo", posts: 300 },
];

const NGN_PLANS = [
  { key: "starter", name: "Starter", price: "₦5,500/mo", posts: 30 },
  { key: "growth", name: "Growth", price: "₦11,000/mo", posts: 100 },
  { key: "agency", name: "Agency", price: "₦27,500/mo", posts: 300 },
];

interface Profile {
  plan: string;
  monthly_post_quota: number;
  posts_used_this_cycle: number;
  x_username: string | null;
  paystack_subscription_code: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<Currency>("usd");
  const [regionLoading, setRegionLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!session?.user) return;
    setEmail(session.user.email ?? "");

    try {
      const res = await fetch("/api/posts");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile ?? null);
      }
    } catch (err) {
      console.error("Failed to load settings data:", err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-detect region and pre-select currency
  useEffect(() => {
    fetch("/api/detect-region")
      .then((r) => r.json())
      .then((data) => setCurrency(data.currency ?? "usd"))
      .catch(() => {})
      .finally(() => setRegionLoading(false));
  }, []);

  async function handleDeleteAccount() {
    if (!confirm("Are you absolutely sure you want to permanently delete your account? This is irreversible.")) return;

    try {
      const res = await fetch("/api/user/delete", {
        method: "DELETE",
      });
      if (res.ok) {
        await signOut({ callbackUrl: "/" });
      } else {
        setMessage({ type: "error", text: "Failed to delete account. Please try again." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    }
  }

  async function handleCheckout(planKey: string) {
    setCheckoutLoading(planKey);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, currency }),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setMessage({ type: "error", text: data.error || "Could not start checkout. Please try again." });
        setCheckoutLoading(null);
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
      setCheckoutLoading(null);
    }
  }

  const plans = currency === "usd" ? USD_PLANS : NGN_PLANS;
  const currentPlan = profile?.plan ?? "free";

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 16 }} />)}
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 6 }}>
          ⚙️ Settings
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Manage your account and billing.</p>
      </div>

      {message && (
        <div style={{
          padding: "14px 18px", borderRadius: 12, marginBottom: 20,
          background: message.type === "success" ? "rgba(74,222,128,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${message.type === "success" ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`,
          color: message.type === "success" ? "#4ADE80" : "#F87171",
          fontSize: "0.875rem",
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Account info */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 20 }}>Account</h2>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="label">Email</label>
            <input className="input" value={email} disabled style={{ opacity: 0.6, cursor: "not-allowed" }} />
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div className="label">Current Plan</div>
              <span className={`badge badge-${currentPlan}`} style={{ textTransform: "capitalize" }}>
                {currentPlan}
              </span>
            </div>
            <div>
              <div className="label">X Account</div>
              <span style={{ fontSize: "0.875rem", color: profile?.x_username ? "#4ADE80" : "var(--text-muted)" }}>
                {profile?.x_username ? `@${profile.x_username}` : "Not connected"}
              </span>
            </div>
            <div>
              <div className="label">Posts this cycle</div>
              <span style={{ fontSize: "0.875rem" }}>
                {profile?.posts_used_this_cycle ?? 0} / {profile?.monthly_post_quota ?? 10}
              </span>
            </div>
          </div>
        </div>

        {/* Billing / Upgrade */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 4 }}>Upgrade Plan</h2>
              {!regionLoading && (
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  📍 {currency === "ngn" ? "Prices in NGN via Paystack" : "Prices in USD via Paystack"}
                </p>
              )}
            </div>
          </div>


          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {plans.map((plan) => {
              const isCurrent = plan.key === currentPlan;
              return (
                <div
                  key={plan.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    borderRadius: 12,
                    border: isCurrent ? "1px solid rgba(255,107,43,0.4)" : "1px solid var(--bg-border)",
                    background: isCurrent ? "rgba(255,107,43,0.06)" : "var(--bg-elevated)",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 2 }}>{plan.name}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                      {plan.price} · {plan.posts} posts/mo
                    </div>
                  </div>
                  {isCurrent ? (
                    <span style={{ fontSize: "0.78rem", color: "var(--brand-orange-light)", fontWeight: 600 }}>
                      ✓ Current Plan
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCheckout(plan.key)}
                      className="btn-primary"
                      disabled={!!checkoutLoading}
                      style={{ padding: "8px 18px", fontSize: "0.8rem" }}
                    >
                      {checkoutLoading === plan.key ? <span className="spinner" /> : "Upgrade"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ marginTop: 12, fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Payments processed securely by Paystack.
          </p>
        </div>

        {/* Danger zone */}
        <div
          className="card"
          style={{ padding: 28, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.03)" }}
        >
          <h2 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 8, color: "#F87171" }}>Danger Zone</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: 16 }}>
            Deleting your account is permanent and irreversible. All posts and settings will be lost.
          </p>
          <button onClick={handleDeleteAccount} className="btn-danger">Delete Account</button>
        </div>

      </div>
    </div>
  );
}
