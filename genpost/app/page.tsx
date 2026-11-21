"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CalendarClock, Feather, Brain, Image as ImageIcon, ShieldCheck, BarChart3, Check } from "lucide-react";
import type { Currency } from "@/lib/geo";
import { PublicNav, PublicFooter } from "@/components/PublicNav";

const FEATURES = [
  { i: Feather, t: "AI draft generation", d: "Pick topics and formats, get 5–50 ready-to-post drafts in seconds, powered by Gemini." },
  { i: Brain, t: "Amnesia voice memory", d: "Your tone, opinions and phrases — remembered across every batch." },
  { i: CalendarClock, t: "Set-and-forget scheduling", d: "Approve, pick a time, and GenPost posts to X for you, even while you sleep." },
  { i: ImageIcon, t: "Media ready", d: "Attach up to 4 images or a single video to any post." },
  { i: BarChart3, t: "Clear quotas", d: "Always see what's posted, failed and queued, and how many posts you've used this month." },
  { i: ShieldCheck, t: "Secure X link", d: "OAuth 2.0 with encrypted tokens (AES-256-GCM). We never see your password." },
];

const POST_TYPES = ["Question", "Hot Take", "Info", "Joke", "News", "Explanation"];

const PLANS = [
  { name: "Free", usd: "$0", ngn: "₦0", posts: "10 posts", features: ["AI draft generation", "1 X account", "Scheduling", "Images & video"], cta: "Start free", href: "/signup" },
  { name: "Starter", usd: "$14", ngn: "₦5,500", posts: "30 posts", features: ["Everything in Free", "30 posts"], cta: "Get Starter", href: "/signup?plan=starter" },
  { name: "Growth", usd: "$35", ngn: "₦11,000", posts: "100 posts", features: ["Everything in Starter", "100 posts"], cta: "Go Growth", href: "/signup?plan=growth", featured: true },
  { name: "Agency", usd: "$89", ngn: "₦27,500", posts: "300 posts", features: ["Everything in Growth", "300 posts", "Cancel anytime"], cta: "Go Agency", href: "/signup?plan=agency" },
];

export default function LandingPage() {
  const { data: session } = useSession();
  const [currency, setCurrency] = useState<Currency>("usd");

  useEffect(() => {
    fetch("/api/detect-region")
      .then((r) => r.json())
      .then((data) => setCurrency(data.currency ?? "usd"))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      <PublicNav />
      <section className="relative overflow-hidden">
        <div className="grid-paper absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          <div>
            <span className="chip mb-6 cursor-default"><span className="size-2 rounded-full bg-primary" /> Now with Amnesia voice memory</span>
            <h1 className="text-5xl font-extrabold leading-[1.02] md:text-6xl">Post every day.<br /><span className="text-primary">Write once a week.</span></h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">GenPost drafts posts in your voice, lets you approve them in a click, and publishes them to X on schedule.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={session ? "/dashboard" : "/signup"} className="btn btn-loud px-6 py-3">{session ? "Go to dashboard" : "Start free"}</Link>
              <a href="#pricing" className="btn btn-ghost px-6 py-3">See pricing</a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">No credit card required · 10 free posts · Cancel anytime</p>
          </div>
          <div className="panel rotate-1 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between text-sm"><span className="font-semibold">This week</span><span className="text-muted-foreground">12 / 100 used</span></div>
            {[["Mon 09:00", "Shipping beats perfect.", "Approved"], ["Tue 18:00", "3 things I stopped doing to write faster…", "Draft"], ["Wed 12:00", "Consistency is a scheduling problem.", "Posted"]].map(([t, x, s]) => (
              <div key={t} className="mb-3 rounded-xl border bg-background p-4 last:mb-0">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{t}</span><span className={s === "Approved" ? "font-semibold text-primary" : ""}>{s}</span></div>
                <p className="text-sm">{x}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-lg text-4xl font-bold">Everything between an idea and a published post.</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ i: I, t, d }) => (
            <div key={t} className="panel p-6">
              <I className="mb-4 size-6 text-primary" />
              <h3 className="text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 text-center">
          <p className="mb-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Post types you can generate</p>
          <div className="flex flex-wrap justify-center gap-2">{POST_TYPES.map((t) => <span key={t} className="chip chip-on cursor-default">{t}</span>)}</div>
        </div>
      </section>

      <section id="pricing" className="bg-ink py-20 text-ink-foreground">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-4xl font-bold">Simple pricing</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.name} className={`flex flex-col rounded-2xl border p-7 ${p.featured ? "border-primary bg-primary text-primary-foreground" : "border-sidebar-border bg-sidebar-accent"}`}>
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <div className="mt-3 font-display text-4xl font-bold">{currency === "ngn" ? p.ngn : p.usd}</div>
                <p className="mt-1 text-sm opacity-70">{p.posts}</p>
                <ul className="mt-6 flex-1 space-y-2 text-sm">{p.features.map((x) => <li key={x} className="flex gap-2"><Check className="size-4 shrink-0" />{x}</li>)}</ul>
                <Link href={session ? "/dashboard/settings" : p.href} className={`btn mt-8 w-full ${p.featured ? "btn-ink" : "btn-loud"}`}>{p.cta}</Link>
              </div>
            ))}
          </div>
          {currency === "ngn" && <p className="mt-6 text-center text-xs opacity-60">Supports Verve, Visa, Mastercard and bank transfer.</p>}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="panel p-10 text-center md:p-14">
          <h2 className="text-3xl font-bold md:text-4xl">Start posting consistently today.</h2>
          <p className="mt-3 text-muted-foreground">Join creators who never miss a post.</p>
          <Link href="/signup" className="btn btn-loud mt-8 px-8 py-3">Get started free</Link>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
