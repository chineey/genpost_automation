"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { Brain, Loader2, Check } from "lucide-react";
import type { Currency } from "@/lib/geo";

const USD_PLANS = [
  { key: "starter", name: "Starter", price: "$14", posts: 30 },
  { key: "growth", name: "Growth", price: "$35", posts: 100, featured: true },
  { key: "agency", name: "Agency", price: "$89", posts: 300 },
];

const NGN_PLANS = [
  { key: "starter", name: "Starter", price: "₦5,500", posts: 30 },
  { key: "growth", name: "Growth", price: "₦11,000", posts: 100, featured: true },
  { key: "agency", name: "Agency", price: "₦27,500", posts: 300 },
];

interface Profile {
  plan: string;
  monthly_post_quota: number;
  posts_used_this_cycle: number;
  x_username: string | null;
  has_subscription: boolean;
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
  const [confirmText, setConfirmText] = useState("");

  // Amnesia (user-voice memory) connection
  const [amnesiaConnected, setAmnesiaConnected] = useState(false);
  const [amnesiaEmail, setAmnesiaEmail] = useState<string | null>(null);
  const [amnesiaKeyPrefix, setAmnesiaKeyPrefix] = useState<string | null>(null);
  const [amnesiaLoading, setAmnesiaLoading] = useState(true);
  const [amnesiaKeyInput, setAmnesiaKeyInput] = useState("");
  const [amnesiaConnecting, setAmnesiaConnecting] = useState(false);
  const [amnesiaAbout, setAmnesiaAbout] = useState("");
  const [amnesiaVoice, setAmnesiaVoice] = useState("");
  const [amnesiaSavingVoice, setAmnesiaSavingVoice] = useState(false);
  const [amnesiaProfile, setAmnesiaProfile] = useState<{
    facts: { content: string; category?: string }[];
    preferences: { content: string; category?: string }[];
  } | null>(null);

  const fetchAmnesiaProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/amnesia/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setAmnesiaProfile({
            facts: data.profile.facts ?? [],
            preferences: data.profile.preferences ?? [],
          });
        }
      }
    } catch {
      // Ignore profile fetch errors on initial load
    }
  }, []);

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

  useEffect(() => {
    fetch("/api/detect-region")
      .then((r) => r.json())
      .then((data) => setCurrency(data.currency ?? "usd"))
      .catch(() => {})
      .finally(() => setRegionLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/amnesia/connect")
      .then((r) => r.json())
      .then((data) => {
        setAmnesiaConnected(!!data.connected);
        setAmnesiaEmail(data.email ?? null);
        setAmnesiaKeyPrefix(data.apiKeyPrefix ?? null);
        if (data.reason === "invalid_key") {
          setMessage({
            type: "error",
            text: "Your previously saved Amnesia API key was revoked or regenerated. Please paste your current Amnesia API key to reconnect.",
          });
        } else if (data.connected) {
          fetchAmnesiaProfile();
        }
      })
      .catch(() => {})
      .finally(() => setAmnesiaLoading(false));
  }, [fetchAmnesiaProfile]);

  async function handleConnectAmnesia() {
    if (!amnesiaKeyInput.trim()) return;
    setAmnesiaConnecting(true);
    try {
      const res = await fetch("/api/amnesia/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: amnesiaKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to connect Amnesia." });
        return;
      }
      setAmnesiaConnected(true);
      setAmnesiaEmail(data.email ?? null);
      setAmnesiaKeyPrefix(data.apiKeyPrefix ?? null);
      setAmnesiaKeyInput("");
      setMessage({ type: "success", text: `Connected to Amnesia as ${data.email}. Your posts will now match your voice.` });
      fetchAmnesiaProfile();
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setAmnesiaConnecting(false);
    }
  }

  async function handleDisconnectAmnesia() {
    if (!confirm("Disconnect Amnesia? Post generation will go back to generic AI voice.")) return;
    try {
      await fetch("/api/amnesia/connect", { method: "DELETE" });
      setAmnesiaConnected(false);
      setAmnesiaEmail(null);
      setAmnesiaKeyPrefix(null);
      setAmnesiaProfile(null);
    } catch {
      setMessage({ type: "error", text: "Failed to disconnect. Please try again." });
    }
  }

  async function handleSaveVoiceNotes() {
    setAmnesiaSavingVoice(true);
    try {
      const res = await fetch("/api/amnesia/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: amnesiaAbout, voice: amnesiaVoice }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to save." });
        return;
      }
      if (data.profile) {
        setAmnesiaProfile({
          facts: data.profile.facts ?? [],
          preferences: data.profile.preferences ?? [],
        });
      }
      setAmnesiaAbout("");
      setAmnesiaVoice("");
      setMessage({ type: "success", text: "Saved to your Amnesia memory profile." });
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setAmnesiaSavingVoice(false);
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("Are you absolutely sure you want to permanently delete your account? This is irreversible.")) return;

    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
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

  const [subBusy, setSubBusy] = useState<"cancel" | "manage" | null>(null);

  async function handleCancelSubscription() {
    if (!confirm("Cancel your subscription? You'll be moved to the Free plan right away.")) return;
    setSubBusy("cancel");
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Could not cancel subscription." });
      } else {
        setMessage({ type: "success", text: "Subscription cancelled. You're now on the Free plan." });
        await fetchData();
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSubBusy(null);
    }
  }

  async function handleManageSubscription() {
    setSubBusy("manage");
    try {
      const res = await fetch("/api/billing/manage", { method: "POST" });
      const data = await res.json();
      if (data.link) {
        window.location.href = data.link;
        return;
      }
      setMessage({ type: "error", text: data.error ?? "Could not open billing portal." });
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    }
    setSubBusy(null);
  }

  const plans = currency === "usd" ? USD_PLANS : NGN_PLANS;
  const currentPlan = profile?.plan ?? "free";

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    );
  }

  const memoryItems = amnesiaProfile ? [...amnesiaProfile.facts, ...amnesiaProfile.preferences] : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${message.type === "success" ? "bg-success/15 text-success" : "border border-destructive/30 bg-destructive/10 text-destructive"}`}>
          {message.text}
        </div>
      )}

      <section className="panel p-6">
        <h2 className="mb-4 text-lg font-semibold">Account</h2>
        <dl className="grid gap-4 sm:grid-cols-4">
          {[
            ["Email", email],
            ["Plan", <span key="p" className="capitalize">{currentPlan}</span>],
            ["X account", profile?.x_username ? `@${profile.x_username}` : "Not linked"],
            ["Posts used", `${profile?.posts_used_this_cycle ?? 0} / ${profile?.monthly_post_quota ?? 10}`],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="truncate font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Brain className="size-5 text-primary" />Amnesia voice memory</h2>
            <p className="mb-4 text-sm text-muted-foreground">Ground your posts in your real writing voice instead of generic AI phrasing.</p>
          </div>
          {!amnesiaLoading && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${amnesiaConnected ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {amnesiaConnected ? "Connected" : "Not connected"}
            </span>
          )}
        </div>

        {amnesiaLoading ? (
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
        ) : !amnesiaConnected ? (
          <div className="flex flex-wrap gap-2">
            <input type="password" className="field min-w-56 flex-1" placeholder="Paste your Amnesia API key (ak_...)" value={amnesiaKeyInput} onChange={(e) => setAmnesiaKeyInput(e.target.value)} />
            <button onClick={handleConnectAmnesia} disabled={amnesiaConnecting || !amnesiaKeyInput.trim()} className="btn btn-ink">
              {amnesiaConnecting ? <Loader2 className="size-4 animate-spin" /> : "Connect"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {(amnesiaEmail || amnesiaKeyPrefix) && (
              <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                <span>Linked to <b>{amnesiaEmail ?? "Amnesia user"}</b></span>
                {amnesiaKeyPrefix && <span className="font-mono text-xs opacity-70">Key: ak_••••{amnesiaKeyPrefix}</span>}
              </p>
            )}
            {memoryItems.length > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="mb-1 font-semibold">Active memory profile ({memoryItems.length} item{memoryItems.length === 1 ? "" : "s"})</p>
                <ul className="space-y-1 text-muted-foreground">
                  {memoryItems.slice(0, 6).map((item, idx) => <li key={idx}>• {item.content}</li>)}
                </ul>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">About you <span className="font-normal text-muted-foreground">(age range, occupation, lifestyle)</span></label>
              <textarea className="field min-h-20" placeholder="e.g. 19-year-old university student, plays basketball" value={amnesiaAbout} onChange={(e) => setAmnesiaAbout(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Voice &amp; tone <span className="font-normal text-muted-foreground">(slang, language quirks)</span></label>
              <textarea className="field min-h-20" placeholder="e.g. Nigerian, uses pidgin sometimes, casual and hype tone" value={amnesiaVoice} onChange={(e) => setAmnesiaVoice(e.target.value)} />
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <button onClick={handleSaveVoiceNotes} disabled={amnesiaSavingVoice || (!amnesiaAbout.trim() && !amnesiaVoice.trim())} className="btn btn-ghost">
                {amnesiaSavingVoice ? <Loader2 className="size-4 animate-spin" /> : "Save to memory"}
              </button>
              <button onClick={handleDisconnectAmnesia} className="btn btn-ghost text-destructive">Disconnect</button>
            </div>
          </div>
        )}
      </section>

      {profile?.has_subscription && (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Subscription</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;re on the <b className="capitalize text-foreground">{currentPlan}</b> plan, billed monthly through Paystack.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={handleManageSubscription} disabled={!!subBusy} className="btn btn-ghost">
              {subBusy === "manage" && <Loader2 className="size-4 animate-spin" />}Update payment method
            </button>
            <button onClick={handleCancelSubscription} disabled={!!subBusy} className="btn btn-ghost text-destructive">
              {subBusy === "cancel" && <Loader2 className="size-4 animate-spin" />}Cancel subscription
            </button>
          </div>
        </section>
      )}

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">{profile?.has_subscription ? "Change plan" : "Upgrade plan"}</h2>
        {!regionLoading && <p className="mb-4 text-xs text-muted-foreground">Prices in {currency === "ngn" ? "NGN" : "USD"} via Paystack</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = p.key === currentPlan;
            return (
              <div key={p.key} className={`rounded-xl border p-4 ${isCurrent || p.featured ? "border-primary" : ""}`}>
                <p className="font-semibold">{p.name}</p>
                <p className="font-display text-2xl font-bold">{p.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <p className="text-xs text-muted-foreground">{p.posts} posts / month</p>
                {isCurrent ? (
                  <button disabled className="btn btn-ghost mt-3 w-full"><Check className="size-4" />Current</button>
                ) : (
                  <button onClick={() => handleCheckout(p.key)} disabled={!!checkoutLoading} className="btn btn-loud mt-3 w-full">
                    {checkoutLoading === p.key ? <Loader2 className="size-4 animate-spin" /> : "Pay with Paystack"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Payments processed securely by Paystack.</p>
      </section>

      <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6">
        <h2 className="text-lg font-semibold text-destructive">Danger zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">Deleting your account removes all posts and disconnects X. It is permanent. Type DELETE to confirm.</p>
        <div className="mt-4 flex gap-2">
          <input className="field max-w-48" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <button disabled={confirmText !== "DELETE"} onClick={handleDeleteAccount} className="btn btn-danger">Delete account</button>
        </div>
      </section>
    </div>
  );
}
