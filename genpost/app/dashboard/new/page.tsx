"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUGGESTED_TOPICS, POST_TYPE_LABELS, POST_TYPE_DESCRIPTIONS, PostType } from "@/lib/gemini";

const ALL_POST_TYPES = Object.keys(POST_TYPE_LABELS) as PostType[];
const COUNT_OPTIONS = [5, 10, 15, 20, 30, 50];

export default function NewPostPage() {
  const router = useRouter();

  // Topic state
  const [customTopic, setCustomTopic] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  // Post type state
  const [selectedTypes, setSelectedTypes] = useState<PostType[]>(["information", "engagement_bait"]);

  // Count + context
  const [count, setCount] = useState(10);
  const [additionalContext, setAdditionalContext] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(0);

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }

  function addCustomTopic() {
    const t = customTopic.trim();
    if (t && !selectedTopics.includes(t)) {
      setSelectedTopics((prev) => [...prev, t]);
      setCustomTopic("");
    }
  }

  function toggleType(type: PostType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
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
        if (data.error === "quota_exceeded") {
          setError(data.message);
        } else {
          setError(data.error ?? "Generation failed. Please try again.");
        }
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 16,
          padding: 40,
        }}
      >
        <div style={{ fontSize: 56 }}>✨</div>
        <h2 className="font-display" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          {generated} posts generated!
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>Redirecting to your dashboard…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 6 }}>
          ✨ Generate Posts
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Tell Genpost what to write about. Your drafts will appear on the dashboard for review.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── Step 1: Topics ── */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 6 }}>
            1. What topics should your posts cover?
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: 18 }}>
            Select from suggestions or add your own. Leave blank for general content.
          </p>

          {/* Suggested topics */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {SUGGESTED_TOPICS.map((t) => (
              <button
                key={t}
                onClick={() => toggleTopic(t)}
                className={`chip ${selectedTopics.includes(t) ? "active" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Custom topic input */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="custom-topic"
              type="text"
              className="input"
              placeholder="Add a custom topic (e.g. Web3, Parenting, Fashion…)"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomTopic()}
              style={{ flex: 1 }}
            />
            <button onClick={addCustomTopic} className="btn-secondary" style={{ flexShrink: 0 }}>
              + Add
            </button>
          </div>

          {/* Selected custom topics */}
          {selectedTopics.filter((t) => !SUGGESTED_TOPICS.includes(t)).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {selectedTopics
                .filter((t) => !SUGGESTED_TOPICS.includes(t))
                .map((t) => (
                  <span
                    key={t}
                    className="chip active"
                    style={{ cursor: "default" }}
                  >
                    {t}
                    <button
                      onClick={() => toggleTopic(t)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          )}

          {selectedTopics.length > 0 && (
            <p style={{ marginTop: 12, fontSize: "0.78rem", color: "var(--brand-orange-light)" }}>
              {selectedTopics.length} topic{selectedTopics.length > 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {/* ── Step 2: Post types ── */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 6 }}>
            2. What types of posts do you want?
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: 18 }}>
            Select one or more. Genpost distributes them evenly across your posts.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ALL_POST_TYPES.map((type) => (
              <label
                key={type}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 18px",
                  borderRadius: 12,
                  cursor: "pointer",
                  border: selectedTypes.includes(type)
                    ? "1px solid rgba(255,107,43,0.4)"
                    : "1px solid var(--bg-border)",
                  background: selectedTypes.includes(type)
                    ? "rgba(255,107,43,0.06)"
                    : "var(--bg-elevated)",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onChange={() => toggleType(type)}
                  style={{ marginTop: 2, accentColor: "var(--brand-orange)", width: 16, height: 16, flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: 2 }}>
                    {POST_TYPE_LABELS[type]}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {POST_TYPE_DESCRIPTIONS[type]}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ── Step 3: Count ── */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 18 }}>
            3. How many posts to generate?
          </h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`chip ${count === n ? "active" : ""}`}
                style={{ minWidth: 50, justifyContent: "center" }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* ── Step 4: Additional context (optional) ── */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 6 }}>
            4. Any extra context? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: 14 }}>
            Describe your brand voice, target audience, or any specific angles to include.
          </p>
          <textarea
            id="additional-context"
            className="textarea"
            placeholder="E.g. 'I'm a senior backend engineer. Keep tone conversational and slightly opinionated. Audience is junior devs.'"
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            style={{ minHeight: 100 }}
          />
        </div>

        {/* ── Error ── */}
        {error && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 10,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#F87171",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Generate button ── */}
        <button
          id="generate-posts-btn"
          onClick={handleGenerate}
          className="btn-primary"
          disabled={loading}
          style={{ padding: "16px 32px", fontSize: "1rem", justifyContent: "center" }}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Generating {count} posts…
            </>
          ) : (
            `✨ Generate ${count} Posts`
          )}
        </button>
      </div>
    </div>
  );
}
