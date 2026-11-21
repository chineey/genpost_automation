"use client";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Logo } from "./Logo";

export function PublicNav() {
  const { data: session } = useSession();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
          <a href="/#features" className="hover:text-foreground">Features</a>
          <a href="/#pricing" className="hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex gap-2">
          {session ? (
            <Link href="/dashboard" className="btn btn-loud">Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">Login</Link>
              <Link href="/signup" className="btn btn-loud">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} GenPost</span>
        <div className="flex gap-6">
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
