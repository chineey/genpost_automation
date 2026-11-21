import type { Metadata } from "next";
import { PublicNav, PublicFooter } from "@/components/PublicNav";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Genpost Privacy Policy — how we collect, use, and protect your data.",
};

const SECTIONS: [string, string][] = [
  ["What We Collect", "We collect your email address (for authentication), X OAuth access/refresh tokens (stored encrypted), posts you create, your subscription status, and standard server logs."],
  ["How We Use It", "Your data is used solely to operate Genpost: authenticating you, generating and scheduling posts on your behalf, and billing you. We do not sell your data."],
  ["X Token Storage", "Your X OAuth tokens are encrypted at rest using AES-256-GCM with a key stored in our server environment. They are decrypted only at the moment of posting and never logged."],
  ["Third-Party Services", "We use: Supabase (database/auth), Paystack (billing/payments), Trigger.dev (background jobs), and Google Gemini API (AI generation). Each has its own privacy policy."],
  ["Data Retention", "We retain your posts and account data while your account is active. You may request deletion at any time via Settings → Delete Account."],
  ["Cookies", "We use session cookies for authentication (managed by Supabase) and a short-lived cookie during the X OAuth flow. No advertising cookies."],
  ["Your Rights", "You may access, export, or delete your data at any time by contacting us or using the in-app controls."],
  ["Security", "We implement industry-standard security: HTTPS everywhere, encrypted token storage, Row-Level Security on all database tables, and no plaintext secrets in code."],
  ["Contact", "Privacy questions: privacy@genpost.io."],
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm font-semibold text-primary">Last updated July 2026</p>
        <h1 className="mt-2 text-4xl font-bold">Privacy Policy</h1>
        <div className="mt-10 space-y-8">
          {SECTIONS.map(([h, b], i) => (
            <section key={h}>
              <h2 className="text-xl font-semibold">{i + 1}. {h}</h2>
              <p className="mt-2 text-muted-foreground">{b}</p>
            </section>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
