"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You declined the X authorization. Please try again.",
  missing_params: "Missing OAuth parameters. Please try again.",
  unauthorized: "Session mismatch. Please sign out and back in.",
  missing_verifier: "OAuth code verifier missing. Please try again.",
  callback_failed: "Connection failed. Please try again.",
  x_already_linked: "This X account is already linked to another Genpost account. Each X account can only be connected to one Genpost account.",
};

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
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");

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
    const res = await fetch("/api/auth/x", { method: "DELETE" });
    if (res.ok) setXUsername(null);
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  return (
    <>
      {errorParam && ERROR_MESSAGES[errorParam] && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />{ERROR_MESSAGES[errorParam]}
        </div>
      )}
      {connected && (
        <div className="mt-6 flex items-center gap-2 rounded-lg bg-success/15 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4" />X account connected successfully!
        </div>
      )}

      <div className="panel mt-8 p-8 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-ink font-display text-3xl font-bold text-ink-foreground">𝕏</div>
        {xUsername ? (
          <>
            <p className="mt-6 flex items-center justify-center gap-2 font-semibold text-success"><CheckCircle2 className="size-5" />Connected and posting</p>
            <p className="mt-1 text-lg font-semibold">@{xUsername}</p>
            <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">GenPost will publish your approved, scheduled posts automatically to this account.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button onClick={handleConnect} className="btn btn-ghost"><RefreshCw className="size-4" />Reconnect</button>
              <button onClick={handleDisconnect} className="btn btn-ghost text-destructive">Disconnect</button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-6 text-lg font-semibold">No account linked</p>
            <p className="mt-1 text-sm text-muted-foreground">You&apos;ll be redirected to X to approve access.</p>
            <button id="connect-x-btn" onClick={handleConnect} disabled={connecting} className="btn btn-loud mt-6 px-8 py-3">
              {connecting ? <Loader2 className="size-4 animate-spin" /> : "Connect with X"}
            </button>
          </>
        )}
        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" />Secured with OAuth 2.0. Tokens are encrypted and we never see your password.</p>
      </div>

      <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
        <b className="text-foreground">Security note:</b> GenPost only gets permission to read and write posts on your behalf. We never access DMs, follower lists or account settings. You can revoke access from X&apos;s Connected Apps settings at any time.
      </p>
    </>
  );
}

export default function ConnectXPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-bold">Connect X</h1>
      <p className="text-muted-foreground">Link your account so GenPost can publish on schedule.</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-2xl bg-muted" />}>
        <ConnectXContent />
      </Suspense>
    </div>
  );
}
