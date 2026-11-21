"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { AuthShell, FormError } from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", { email, password, redirect: false });

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <AuthShell title="Welcome back" sub="Log in to manage your scheduled posts.">
      <form className="space-y-4" onSubmit={handleLogin}>
        {error && <FormError>{error}</FormError>}
        <div>
          <label htmlFor="login-email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="login-email" required type="email" className="field" placeholder="you@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-1 block text-sm font-medium">Password</label>
          <input id="login-password" required type="password" className="field" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button id="login-submit" type="submit" disabled={loading} className="btn btn-loud w-full py-3">
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        New here? <Link href="/signup" className="font-semibold text-primary">Create an account</Link>
      </p>
    </AuthShell>
  );
}
