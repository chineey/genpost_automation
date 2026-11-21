"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, Loader2, Plus, X, CheckCircle2, TriangleAlert } from "lucide-react";
import { SUGGESTED_TOPICS, POST_TYPE_LABELS, POST_TYPE_DESCRIPTIONS, PostType } from "@/lib/gemini";

const ALL_POST_TYPES = Object.keys(POST_TYPE_LABELS) as PostType[];
const COUNT_OPTIONS = [5, 10, 15, 20, 30, 50];

function Step({ n, title, hint, children }: { n: number; title: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="panel p-6">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-sm text-ink-foreground">{n}</span>
        {title}
      </h2>
      {hint && <p className="mt-1 mb-4 ml-10 text-sm text-muted-foreground">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </div>
  );
}

export default function NewPostPage() {
  const router = useRouter();

  const [customTopic, setCustomTopic] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const [selectedTypes, setSelectedTypes] = useState<PostType[]>(["information", "engagement_bait"]);
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [customTypeInput, setCustomTypeInput] = useState("");

  const [count, setCount] = useState(10);
  const [additionalContext, setAdditionalContext] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(0);
  const [amnesiaStatus, setAmnesiaStatus] = useState<{ loading: boolean; connected: boolean; email?: string | null }>({
    loading: true,
    connected: false,
  });

  useEffect(() => {
    fetch("/api/amnesia/connect")
      .then((r) => r.json())
      .then((data) => setAmnesiaStatus({ loading: false, connected: !!data.connected, email: data.email ?? null }))
      .catch(() => setAmnesiaStatus({ loading: false, connected: false }));
  }, []);

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]));
  }

  function addCustomTopic() {
    const t = customTopic.trim();
    if (t && !selectedTopics.includes(t)) {
      setSelectedTopics((prev) => [...prev, t]);
      setCustomTopic("");
    }
  }

  function toggleType(type: PostType) {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  function addCustomType() {
    const t = customTypeInput.trim();
    if (t && !customTypes.includes(t) && !ALL_POST_TYPES.includes(t as any)) {
      setCustomTypes((prev) => [...prev, t]);
      setSelectedTypes((prev) => [...prev, t as PostType]);
      setCustomTypeInput("");
    }
  }

  function removeCustomType(t: string) {
    setCustomTypes((prev) => prev.filter((item) => item !== t));
    setSelectedTypes((prev) => prev.filter((item) => item !== t));
  }

  async function handleGenerate() {
    const topics = selectedTopics.length > 0 ? selectedTopics : ["general"];

    if (selectedTypes.length === 0) {
      setError("Select at least one post type.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics, postTypes: selectedTypes, count, additionalContext }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error === "quota_exceeded" ? data.message : (data.error ?? "Generation failed. Please try again."));
        setLoading(false);
        return;
      }

      setGenerated(data.generated);
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
    }
  }

  if (generated > 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <CheckCircle2 className="size-14 text-success" />
        <h2 className="text-2xl font-bold">{generated} posts generated!</h2>
        <p className="text-muted-foreground">Redirecting to your dashboard…</p>
      </div>
    );
  }

  const customSelectedTopics = selectedTopics.filter((t) => !SUGGESTED_TOPICS.includes(t));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Generate posts</h1>
          <p className="text-muted-foreground">Drafts land in your post list for review.</p>
        </div>
        {!amnesiaStatus.loading && (
          <Link href="/dashboard/settings" className="chip">
            <Brain className="size-4 text-primary" />
            {amnesiaStatus.connected ? (
              <>Amnesia: <b>connected</b>{amnesiaStatus.email ? ` (${amnesiaStatus.email})` : ""}<span className="size-2 rounded-full bg-success" /></>
            ) : (
              <>Connect Amnesia in Settings →</>
            )}
          </Link>
        )}
      </div>

      <div className="mt-8 space-y-4">
        <Step n={1} title="Topics" hint="Select from suggestions or add your own. Leave blank for general content.">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TOPICS.map((t) => (
              <button key={t} onClick={() => toggleTopic(t)} className={`chip ${selectedTopics.includes(t) ? "chip-on" : ""}`}>{t}</button>
            ))}
            {customSelectedTopics.map((t) => (
              <span key={t} className="chip chip-on cursor-default">
                {t}
                <button onClick={() => toggleTopic(t)} aria-label={`Remove ${t}`}><X className="size-3" /></button>
              </span>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); addCustomTopic(); }} className="flex items-center gap-1 rounded-full border border-dashed px-2">
              <input id="custom-topic" value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} placeholder="Custom topic" className="w-32 bg-transparent py-1 text-sm outline-none" />
              <button type="submit" aria-label="Add topic"><Plus className="size-4 text-primary" /></button>
            </form>
          </div>
          {selectedTopics.length > 0 && <p className="mt-3 text-xs text-primary">{selectedTopics.length} topic{selectedTopics.length > 1 ? "s" : ""} selected</p>}
        </Step>

        <Step n={2} title="Post types" hint="Select one or more. Genpost distributes them evenly across your posts.">
          <div className="space-y-2">
            {ALL_POST_TYPES.map((type) => {
              const on = selectedTypes.includes(type);
              return (
                <label key={type} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${on ? "border-primary bg-accent/50" : "hover:bg-muted"}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleType(type)} className="mt-1 size-4 accent-primary" />
                  <div>
                    <div className="text-sm font-semibold">{POST_TYPE_LABELS[type]}</div>
                    <div className="text-xs text-muted-foreground">{POST_TYPE_DESCRIPTIONS[type]}</div>
                  </div>
                </label>
              );
            })}
            {customTypes.map((type) => {
              const on = selectedTypes.includes(type as PostType);
              return (
                <div key={type} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${on ? "border-primary bg-accent/50" : ""}`}>
                  <label className="flex flex-1 cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={on} onChange={() => toggleType(type as PostType)} className="mt-1 size-4 accent-primary" />
                    <div>
                      <div className="text-sm font-semibold">{type}</div>
                      <div className="text-xs text-muted-foreground">Custom post type</div>
                    </div>
                  </label>
                  <button onClick={() => removeCustomType(type)} className="text-sm text-destructive">Remove</button>
                </div>
              );
            })}
            <div className="flex gap-2 pt-2">
              <input
                id="custom-type-input"
                className="field"
                placeholder="Add a custom post type (e.g. Tutorial, Quote…)"
                value={customTypeInput}
                onChange={(e) => setCustomTypeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomType()}
              />
              <button onClick={addCustomType} className="btn btn-ghost shrink-0"><Plus className="size-4" />Add</button>
            </div>
          </div>
        </Step>

        <Step n={3} title={<>How many? <span className="ml-auto font-display text-3xl text-primary">{count}</span></>}>
          <div className="flex flex-wrap gap-2">
            {COUNT_OPTIONS.map((n) => (
              <button key={n} onClick={() => setCount(n)} className={`chip min-w-12 justify-center ${count === n ? "chip-on" : ""}`}>{n}</button>
            ))}
          </div>
        </Step>

        <Step n={4} title={<>Extra context <span className="text-sm font-normal text-muted-foreground">optional</span></>} hint="Describe your brand voice, target audience, or specific angles to include.">
          <textarea
            id="additional-context"
            className="field min-h-24"
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="e.g. I'm a senior backend engineer. Keep the tone conversational and slightly opinionated."
          />
        </Step>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />{error}
          </div>
        )}

        <button id="generate-posts-btn" disabled={loading} onClick={handleGenerate} className="btn btn-loud w-full py-4 text-base">
          {loading ? <><Loader2 className="size-5 animate-spin" />Generating {count} drafts…</> : `Generate ${count} drafts`}
        </button>
      </div>
    </div>
  );
}
