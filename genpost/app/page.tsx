"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { Currency } from "@/lib/geo";

const FEATURES = [
  {
    icon: "⚡",
    title: "AI Draft Generation",
    desc: "Tell Genpost your topic and tone. Get 10–50 ready-to-post drafts in seconds, powered by Gemini AI.",
  },
  {
    icon: "📅",
    title: "Smart Scheduling",
    desc: "Pick your slots. Genpost publishes on the dot — even while you sleep — with a rock-solid cron engine.",
  },
  {
    icon: "🔗",
    title: "One-Click X Connect",
    desc: "Securely link your X account with OAuth 2.0. Genpost posts on your behalf, never storing your password.",
  },
  {
    icon: "📊",
    title: "Post Analytics",
    desc: "See what's posted, what failed, and what's queued — all in a clean, real-time dashboard.",
  },
  {
    icon: "🎯",
    title: "Any Niche. Any Topic.",
    desc: "Tech, business, lifestyle, finance — define your niche and post types. Genpost adapts to your brand.",
  },
  {
    icon: "🔒",
    title: "Bank-Grade Security",
    desc: "All tokens encrypted with AES-256-GCM. Row-Level Security on every database row. Your data stays yours.",
  },
];

const POST_TYPES = ["Question", "Hot Take", "Info", "Joke", "News", "Explanation"];
const DEMO_POSTS = [
  {
    type: "Hot Take",
    topic: "AI/ML",
    content: "Unpopular opinion: most 'AI engineers' are just writing prompt wrappers. Real AI engineering is still rare.",
    chars: 112,
  },
  {
    type: "Joke",
    topic: "Backend",
    content: "My code works in dev, staging, and every machine except production. Classic.",
    chars: 76,
  },
  {
    type: "Info",
    topic: "Python",
    content: "Python walrus operator (:=) lets you assign and evaluate in one line. Saves a surprising amount of boilerplate.",
    chars: 108,
  },
];

const USD_PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "7 days",
    posts: "10 posts",
    badge: "badge-free",
    features: ["AI draft generation", "1 X account", "Basic scheduling", "Dashboard access"],
    cta: "Start Free Trial",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$14",
    period: "/month",
    posts: "30 posts/mo",
    badge: "badge-starter",
    features: ["Everything in Free", "30 posts/month", "AI drafts unlimited", "Email support"],
    cta: "Get Started",
    href: "/signup?plan=starter",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$35",
    period: "/month",
    posts: "100 posts/mo",
    badge: "badge-growth",
    features: ["Everything in Starter", "100 posts/month", "Post analytics", "Priority support"],
    cta: "Go Growth",
    href: "/signup?plan=growth",
    highlighted: true,
  },
  {
    name: "Agency",
    price: "$89",
    period: "/month",
    posts: "300+ posts/mo",
    badge: "badge-agency",
    features: ["Everything in Growth", "300+ posts/month", "Multiple X accounts", "Dedicated support"],
    cta: "Go Agency",
    href: "/signup?plan=agency",
    highlighted: false,
  },
];

const NGN_PLANS = [
  {
    name: "Free",
    price: "₦0",
    period: "7 days",
    posts: "10 posts",
    badge: "badge-free",
    features: ["AI draft generation", "1 X account", "Basic scheduling", "Dashboard access"],
    cta: "Start Free Trial",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "₦5,500",
    period: "/month",
    posts: "30 posts/mo",
    badge: "badge-starter",
    features: ["Everything in Free", "30 posts/month", "AI drafts unlimited", "Email support"],
    cta: "Get Started",
    href: "/signup?plan=starter",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "₦11,000",
    period: "/month",
    posts: "100 posts/mo",
    badge: "badge-growth",
    features: ["Everything in Starter", "100 posts/month", "Post analytics", "Priority support"],
    cta: "Go Growth",
    href: "/signup?plan=growth",
    highlighted: true,
  },
  {
    name: "Agency",
    price: "₦27,500",
    period: "/month",
    posts: "300+ posts/mo",
    badge: "badge-agency",
    features: ["Everything in Growth", "300+ posts/month", "Multiple X accounts", "Dedicated support"],
    cta: "Go Agency",
    href: "/signup?plan=agency",
    highlighted: false,
  },
];

export default function LandingPage() {
  const [currency, setCurrency] = useState<Currency>("usd");
  const [detectedRegion, setDetectedRegion] = useState<string | null>(null);
  const [regionLoading, setRegionLoading] = useState(true);
  const [demoIdx, setDemoIdx] = useState(0);

  // Auto-detect region on first load
  useEffect(() => {
    fetch("/api/detect-region")
      .then((r) => r.json())
      .then((data) => {
        setCurrency(data.currency ?? "usd");
        setDetectedRegion(data.region ?? null);
      })
      .catch(() => {
        // silently fall back to USD
      })
      .finally(() => setRegionLoading(false));
  }, []);

  const plans = currency === "usd" ? USD_PLANS : NGN_PLANS;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* ── NAV ── */}
      <nav
        className="glass"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "0 24px",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 64,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "linear-gradient(135deg, #FF6B2B, #FFAA00)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              ⚡
            </div>
            <span
              className="font-display"
              style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)" }}
            >
              Genpost
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/login" className="btn-ghost">
              Sign In
            </Link>
            <Link href="/signup" className="btn-primary" style={{ padding: "9px 20px", fontSize: "0.85rem" }}>
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        style={{
          paddingTop: 140,
          paddingBottom: 100,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background orbs */}
        <div
          className="orb orb-orange"
          style={{ width: 600, height: 600, top: -100, left: "50%", transform: "translateX(-50%)", opacity: 0.4 }}
        />
        <div
          className="orb orb-amber"
          style={{ width: 300, height: 300, top: 200, right: 100 }}
        />
        <div
          className="orb orb-purple"
          style={{ width: 400, height: 400, bottom: 0, left: 100 }}
        />

        {/* Grid pattern */}
        <div
          className="grid-pattern"
          style={{ position: "absolute", inset: 0, opacity: 0.5 }}
        />

        <div className="container" style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div
            className="animate-fade-up"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 9999,
              background: "rgba(255,107,43,0.1)",
              border: "1px solid rgba(255,107,43,0.25)",
              color: "var(--brand-orange-light)",
              fontSize: "0.8rem",
              fontWeight: 600,
              marginBottom: 32,
              letterSpacing: "0.05em",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF6B2B", display: "inline-block" }} />
            AI-POWERED · AUTO-POSTS · ZERO EFFORT
          </div>

          <h1
            className="font-display animate-fade-up delay-100"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: 24,
              letterSpacing: "-0.03em",
            }}
          >
            Your X presence,{" "}
            <span className="gradient-text">on autopilot.</span>
          </h1>

          <p
            className="animate-fade-up delay-200"
            style={{
              fontSize: "clamp(1rem, 2vw, 1.25rem)",
              color: "var(--text-secondary)",
              maxWidth: 560,
              margin: "0 auto 40px",
              lineHeight: 1.7,
            }}
          >
            Tell Genpost your topic. Get AI-crafted posts. Approve in seconds.
            Genpost publishes automatically — every day, while you focus on what matters.
          </p>

          <div
            className="animate-fade-up delay-300"
            style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
          >
            <Link href="/signup" className="btn-primary" style={{ padding: "14px 32px", fontSize: "1rem" }}>
              Start for Free →
            </Link>
            <a href="#pricing" className="btn-secondary" style={{ padding: "14px 28px", fontSize: "1rem" }}>
              View Pricing
            </a>
          </div>

          <p
            className="animate-fade-up delay-400"
            style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 16 }}
          >
            No credit card required • 10 free posts • Cancel anytime
          </p>
        </div>
      </section>

      {/* ── DEMO CARD ── */}
      <section style={{ padding: "0 0 100px" }}>
        <div className="container">
          <div
            className="card animate-float"
            style={{
              maxWidth: 720,
              margin: "0 auto",
              padding: 32,
              background: "var(--bg-card)",
              position: "relative",
            }}
          >
            {/* Animated border glow */}
            <div
              style={{
                position: "absolute",
                inset: -1,
                borderRadius: "inherit",
                background: "linear-gradient(135deg, rgba(255,107,43,0.4), transparent, rgba(255,170,0,0.3))",
                zIndex: -1,
                filter: "blur(2px)",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(255,107,43,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  ⚡
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>AI Generated Draft</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Topic: {DEMO_POSTS[demoIdx].topic} · Type: {DEMO_POSTS[demoIdx].type}
                  </div>
                </div>
              </div>
              <span className={`badge badge-draft`}>Draft</span>
            </div>

            <div
              style={{
                background: "var(--bg-elevated)",
                borderRadius: 12,
                padding: "20px 24px",
                marginBottom: 20,
                border: "1px solid var(--bg-border)",
                fontSize: "1rem",
                lineHeight: 1.7,
                color: "var(--text-primary)",
              }}
            >
              &ldquo;{DEMO_POSTS[demoIdx].content}&rdquo;
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8 }}>
                {DEMO_POSTS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setDemoIdx(i)}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: i === demoIdx ? "var(--brand-orange)" : "var(--bg-elevated)",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" style={{ padding: "8px 16px", fontSize: "0.8rem" }}>
                  ✏️ Edit
                </button>
                <button className="btn-primary" style={{ padding: "8px 16px", fontSize: "0.8rem" }}>
                  ✓ Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: "80px 0" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2
              className="font-display"
              style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 700, marginBottom: 16 }}
            >
              Everything you need to{" "}
              <span className="gradient-text">grow on X</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem" }}>
              Built for creators, founders, and agencies who don&apos;t have time to post manually.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="card"
                style={{ padding: 28 }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(255,107,43,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    marginBottom: 16,
                  }}
                >
                  {f.icon}
                </div>
                <h3 style={{ fontWeight: 600, marginBottom: 8, fontSize: "1rem" }}>{f.title}</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POST TYPES ── */}
      <section style={{ padding: "60px 0" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.1em", marginBottom: 20, textTransform: "uppercase" }}>
            Post types you can generate
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {POST_TYPES.map((t) => (
              <span key={t} className="chip active">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: "100px 0" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2
              className="font-display"
              style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 700, marginBottom: 16 }}
            >
              Simple, transparent pricing
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 28 }}>
              Start free. Scale as you grow. No hidden fees.
            </p>

            {/* Currency toggle */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  display: "inline-flex",
                  background: regionLoading ? "var(--bg-elevated)" : "var(--bg-elevated)",
                  borderRadius: 9999,
                  padding: 4,
                  border: "1px solid var(--bg-border)",
                  gap: 4,
                  opacity: regionLoading ? 0.5 : 1,
                  transition: "opacity 0.3s ease",
                }}
              >
                <button
                  onClick={() => setCurrency("usd")}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 9999,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    background: currency === "usd" ? "linear-gradient(135deg, #FF6B2B, #FF8C5A)" : "transparent",
                    color: currency === "usd" ? "white" : "var(--text-secondary)",
                    transition: "all 0.2s",
                  }}
                >
                  $ USD
                </button>
                <button
                  onClick={() => setCurrency("ngn")}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 9999,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    background: currency === "ngn" ? "linear-gradient(135deg, #FF6B2B, #FF8C5A)" : "transparent",
                    color: currency === "ngn" ? "white" : "var(--text-secondary)",
                    transition: "all 0.2s",
                  }}
                >
                  ₦ NGN
                </button>
              </div>

              {/* Detected region hint */}
              {!regionLoading && detectedRegion && (
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ opacity: 0.5 }}>📍</span>
                  {detectedRegion === "africa"
                    ? "Showing African pricing via Paystack — you can switch above"
                    : "Showing global pricing via Paystack — you can switch above"}
                </p>
              )}
            </div>
          </div>


          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 20,
            }}
          >
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="card"
                style={{
                  padding: 28,
                  position: "relative",
                  ...(plan.highlighted
                    ? {
                        border: "1px solid rgba(255,107,43,0.4)",
                        background: "rgba(255,107,43,0.05)",
                      }
                    : {}),
                }}
              >
                {plan.highlighted && (
                  <div
                    style={{
                      position: "absolute",
                      top: -14,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "linear-gradient(135deg, #FF6B2B, #FFAA00)",
                      color: "white",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "4px 14px",
                      borderRadius: 9999,
                      letterSpacing: "0.08em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    MOST POPULAR
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <span className={`badge ${plan.badge}`} style={{ marginBottom: 12, display: "inline-flex" }}>
                    {plan.name}
                  </span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 8 }}>
                    <span
                      className="font-display"
                      style={{ fontSize: "2rem", fontWeight: 800 }}
                    >
                      {plan.price}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{plan.period}</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: 4 }}>
                    {plan.posts}
                  </div>
                </div>

                <div className="divider" style={{ marginBottom: 20 }} />

                <ul style={{ listStyle: "none", marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      <span style={{ color: "#4ADE80", flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={plan.highlighted ? "btn-primary" : "btn-secondary"}
                  style={{ display: "flex", justifyContent: "center", width: "100%" }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {currency === "ngn" && (
            <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem", marginTop: 20 }}>
              NGN prices are PPP-adjusted. Payment via Paystack — supports Verve, Visa, Mastercard, bank transfer.
            </p>
          )}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ padding: "80px 0 120px" }}>
        <div className="container">
          <div
            style={{
              borderRadius: 24,
              padding: "60px 40px",
              background: "linear-gradient(135deg, rgba(255,107,43,0.15) 0%, rgba(255,170,0,0.1) 100%)",
              border: "1px solid rgba(255,107,43,0.2)",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div className="orb orb-orange" style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)" }} />
            <h2
              className="font-display"
              style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 700, marginBottom: 16, position: "relative", zIndex: 1 }}
            >
              Start posting consistently today.
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 32, fontSize: "1.05rem", position: "relative", zIndex: 1 }}>
              Join creators who never miss a post.
            </p>
            <Link href="/signup" className="btn-primary" style={{ padding: "16px 40px", fontSize: "1.05rem", position: "relative", zIndex: 1 }}>
              Get Started Free →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid var(--bg-border)", padding: "40px 0 32px" }}>
        <div
          className="container"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: "linear-gradient(135deg, #FF6B2B, #FFAA00)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
              }}
            >
              ⚡
            </div>
            <span className="font-display" style={{ fontWeight: 700, fontSize: "0.95rem" }}>Genpost</span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <Link href="/terms" style={{ color: "var(--text-muted)", fontSize: "0.8rem", textDecoration: "none" }}>Terms of Service</Link>
            <Link href="/privacy" style={{ color: "var(--text-muted)", fontSize: "0.8rem", textDecoration: "none" }}>Privacy Policy</Link>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            © {new Date().getFullYear()} Genpost. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
