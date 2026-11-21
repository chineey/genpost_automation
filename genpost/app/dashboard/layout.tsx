"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutList, Feather, Link2, Settings, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";

const NAV = [
  { href: "/dashboard", label: "Posts", icon: LayoutList },
  { href: "/dashboard/new", label: "Generate", icon: Feather },
  { href: "/dashboard/connect-x", label: "Connect X", icon: Link2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-sidebar p-4 text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-60 md:gap-6 md:p-5">
        <div className="flex items-center justify-between">
          <Logo invert href="/dashboard" />
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-2 text-sm hover:text-sidebar-accent-foreground md:hidden" aria-label="Log out">
            <LogOut className="size-4" />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap hover:bg-sidebar-accent ${active ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground [&>svg]:text-sidebar-primary" : ""}`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden md:block">
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-2 text-sm hover:text-sidebar-accent-foreground">
            <LogOut className="size-4" />
            Log out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-10">{children}</main>
    </div>
  );
}
