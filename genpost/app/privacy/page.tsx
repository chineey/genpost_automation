import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Genpost Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", padding: "100px 24px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 40 }}>
          ← Back to Genpost
        </Link>
        <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 48 }}>Last updated: July 2026</p>

        {[
          { title: "1. What We Collect", body: "We collect your email address (for authentication), X OAuth access/refresh tokens (stored encrypted), posts you create, your subscription status, and standard server logs." },
          { title: "2. How We Use It", body: "Your data is used solely to operate Genpost: authenticating you, generating and scheduling posts on your behalf, and billing you. We do not sell your data." },
          { title: "3. X Token Storage", body: "Your X OAuth tokens are encrypted at rest using AES-256-GCM with a key stored in our server environment. They are decrypted only at the moment of posting and never logged." },
          { title: "4. Third-Party Services", body: "We use: Supabase (database/auth), Paystack (billing/payments), Trigger.dev (background jobs), and Google Gemini API (AI generation). Each has its own privacy policy." },
          { title: "5. Data Retention", body: "We retain your posts and account data while your account is active. You may request deletion at any time via Settings → Delete Account." },
          { title: "6. Cookies", body: "We use session cookies for authentication (managed by Supabase) and a short-lived cookie during the X OAuth flow. No advertising cookies." },
          { title: "7. Your Rights", body: "You may access, export, or delete your data at any time by contacting us or using the in-app controls." },
          { title: "8. Security", body: "We implement industry-standard security: HTTPS everywhere, encrypted token storage, Row-Level Security on all database tables, and no plaintext secrets in code." },
          { title: "9. Contact", body: "Privacy questions: privacy@genpost.io." },
        ].map((s) => (
          <section key={s.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 10, color: "var(--text-primary)" }}>{s.title}</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7 }}>{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
