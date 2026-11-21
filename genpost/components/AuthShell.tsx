import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

export function AuthShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-ink-foreground md:flex">
        <Logo invert />
        <blockquote className="font-display text-3xl font-semibold leading-tight">
          “I went from posting twice a month to every single day. <span className="text-primary">It still sounds like me.</span>”
        </blockquote>
        <span className="text-sm opacity-60">— Ada, indie founder</span>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden"><Logo /></div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-1 mb-8 text-muted-foreground">{sub}</p>
          {children}
          <p className="mt-8 text-xs text-muted-foreground">
            By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{children}</div>;
}
