import type { Metadata } from "next";
import { PublicNav, PublicFooter } from "@/components/PublicNav";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Genpost Terms of Service — the rules governing your use of the platform.",
};

const SECTIONS: [string, string][] = [
  ["Acceptance", "By creating a Genpost account you agree to these Terms. If you do not agree, do not use the service."],
  ["Service Description", "Genpost is an AI-powered social media scheduling tool that publishes posts to X (Twitter) on your behalf using OAuth 2.0 authorization."],
  ["User Responsibilities", "You are solely responsible for the content of posts you generate, approve, and schedule. Genpost is a tool — you are the publisher. You must comply with X's Terms of Service and all applicable laws."],
  ["X API Usage", "Genpost uses the X API to post on your behalf. X charges per-post fees which are factored into our subscription pricing. Rates may change; we will notify you of material pricing changes."],
  ["Account Security", "You are responsible for keeping your account credentials secure. Your X OAuth tokens are encrypted at rest. Notify us immediately of any unauthorized use."],
  ["Subscriptions and Billing", "Paid plans are billed monthly via Paystack (in USD or NGN). You may cancel at any time. Refunds are handled on a case-by-case basis."],
  ["Prohibited Content", "You may not use Genpost to publish spam, illegal content, harassment, hate speech, or any content that violates X's rules or applicable law."],
  ["Termination", "We may suspend or terminate accounts that violate these Terms. You may delete your account at any time from Settings."],
  ["Limitation of Liability", "Genpost is provided 'as is'. We are not liable for any lost revenue, missed posts, or X API outages. Our maximum liability is limited to the amount you paid us in the prior 30 days."],
  ["Changes", "We may update these Terms. Continued use after notice constitutes acceptance."],
  ["Contact", "For questions, contact us at support@genpost.io."],
];

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm font-semibold text-primary">Last updated July 2026</p>
        <h1 className="mt-2 text-4xl font-bold">Terms of Service</h1>
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
