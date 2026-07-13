import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Genpost Terms of Service — the rules governing your use of the platform.",
};

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", padding: "100px 24px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 40 }}>
          ← Back to Genpost
        </Link>
        <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 48 }}>Last updated: July 2026</p>

        {[
          { title: "1. Acceptance", body: "By creating a Genpost account you agree to these Terms. If you do not agree, do not use the service." },
          { title: "2. Service Description", body: "Genpost is an AI-powered social media scheduling tool that publishes posts to X (Twitter) on your behalf using OAuth 2.0 authorization." },
          { title: "3. User Responsibilities", body: "You are solely responsible for the content of posts you generate, approve, and schedule. Genpost is a tool — you are the publisher. You must comply with X's Terms of Service and all applicable laws." },
          { title: "4. X API Usage", body: "Genpost uses the X API to post on your behalf. X charges per-post fees which are factored into our subscription pricing. Rates may change; we will notify you of material pricing changes." },
          { title: "5. Account Security", body: "You are responsible for keeping your account credentials secure. Your X OAuth tokens are encrypted at rest. Notify us immediately of any unauthorized use." },
          { title: "6. Subscriptions and Billing", body: "Paid plans are billed monthly via Paystack (in USD or NGN). You may cancel at any time. Refunds are handled on a case-by-case basis." },
          { title: "7. Prohibited Content", body: "You may not use Genpost to publish spam, illegal content, harassment, hate speech, or any content that violates X's rules or applicable law." },
          { title: "8. Termination", body: "We may suspend or terminate accounts that violate these Terms. You may delete your account at any time from Settings." },
          { title: "9. Limitation of Liability", body: "Genpost is provided 'as is'. We are not liable for any lost revenue, missed posts, or X API outages. Our maximum liability is limited to the amount you paid us in the prior 30 days." },
          { title: "10. Changes", body: "We may update these Terms. Continued use after notice constitutes acceptance." },
          { title: "11. Contact", body: "For questions, contact us at support@genpost.io." },
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
