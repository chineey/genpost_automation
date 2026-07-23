"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense } from "react";

function ConnectXContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const connected = searchParams.get("connected");

  const [xUsername, setXUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/posts");
      if (res.ok) {
        const data = await res.json();
        setXUsername(data.profile?.x_username ?? null);
      }
    } catch (err) {
      console.error("Failed to fetch connection status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  async function handleConnect() {
    setConnecting(true);
    // Generate a simple code verifier (32 random bytes as hex)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");

    // Store verifier in cookie for the callback to retrieve
    document.cookie = `x_code_verifier=${encodeURIComponent(codeVerifier)}; path=/; max-age=600; SameSite=Lax`;

    const userId = (session?.user as any)?.id;
    if (!userId) return;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.NEXT_PUBLIC_X_CLIENT_ID!,
      redirect_uri: `${window.location.origin}/api/auth/x/callback`,
      scope: "tweet.read tweet.write users.read offline.access",
      state: userId,
      code_challenge: codeVerifier,
      code_challenge_method: "plain",
    });

    window.location.href = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your X account? Scheduled posts will stop publishing.")) return;
    
    const res = await fetch("/api/auth/x", {
      method: "DELETE",
    });

    if (res.ok) {
      setXUsername(null);
    }
  }

  const ERROR_MESSAGES: Record<string, string> = {
    access_denied: "You declined the X authorization. Please try again.",
    missing_params: "Missing OAuth parameters. Please try again.",
    unauthorized: "Session mismatch. Please sign out and back in.",
    missing_verifier: "OAuth code verifier missing. Please try again.",
    callback_failed: "Connection failed. Please try again.",
    x_already_linked: "This X account is already linked to another Genpost account. Each X account can only be connected to one Genpost account.",
  };

  if (loading) {
    return <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />;
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Error banner */}
      {errorParam && ERROR_MESSAGES[errorParam] && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#F87171",
            fontSize: "0.875rem",
            marginBottom: 20,
          }}
        >
          ⚠️ {ERROR_MESSAGES[errorParam]}
        </div>
      )}

      {/* Success banner */}
      {connected && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(74,222,128,0.1)",
            border: "1px solid rgba(74,222,128,0.2)",
            color: "#4ADE80",
            fontSize: "0.875rem",
            marginBottom: 20,
          }}
        >
          ✅ X account connected successfully!
        </div>
      )}

      {/* Connection card */}
      <div className="card responsive-card">
        {xUsername ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #1DA1F2, #0d8bd9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  flexShrink: 0,
                }}
              >
                𝕏
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>@{xUsername}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <div className="status-dot green" />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Connected and posting</span>
                </div>
              </div>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 24 }}>
              Genpost will publish your approved, scheduled posts automatically to this account.
              Your access tokens are encrypted with AES-256-GCM.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={handleConnect} className="btn-secondary" style={{ padding: "10px 20px" }}>
                🔄 Reconnect
              </button>
              <button onClick={handleDisconnect} className="btn-danger" style={{ padding: "10px 20px" }}>
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "var(--bg-elevated)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                marginBottom: 20,
                border: "2px dashed var(--bg-border)",
              }}
            >
              𝕏
            </div>
            <h2 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 10 }}>
              Connect your X account
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.7, marginBottom: 24 }}>
              Genpost uses OAuth 2.0 to post on your behalf — your password is never stored.
              Tokens are encrypted and auto-refreshed before each post.
            </p>

            <button
              id="connect-x-btn"
              onClick={handleConnect}
              disabled={connecting}
              className="btn-primary"
              style={{ padding: "13px 28px" }}
            >
              {connecting ? <span className="spinner" /> : "Connect X Account →"}
            </button>
          </>
        )}
      </div>

      {/* Security info */}
      <div
        style={{
          marginTop: 20,
          padding: "16px 20px",
          borderRadius: 12,
          background: "rgba(255,170,0,0.06)",
          border: "1px solid rgba(255,170,0,0.15)",
          fontSize: "0.8rem",
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}
      >
        🔒 <strong style={{ color: "var(--text-primary)" }}>Security note:</strong> Genpost only receives
        permission to <em>read</em> and <em>write tweets</em> on your behalf. We never access DMs, followers lists,
        or account settings. You can revoke access from X&apos;s Connected Apps settings at any time.
      </div>
    </div>
  );
}

export default function ConnectXPage() {
  return (
    <div className="responsive-padding" style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 6 }}>
          🔗 Connect X Account
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Link your X (Twitter) account so Genpost can publish on your behalf.
        </p>
      </div>
      <Suspense fallback={<div className="skeleton" style={{ height: 200, borderRadius: 16 }} />}>
        <ConnectXContent />
      </Suspense>
    </div>
  );
}
