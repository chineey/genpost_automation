"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "🏠", label: "Dashboard" },
  { href: "/dashboard/new", icon: "✨", label: "Generate Posts" },
  { href: "/dashboard/connect-x", icon: "🔗", label: "Connect X" },
  { href: "/dashboard/settings", icon: "⚙️", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  async function handleLogout() {
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="dashboard-container">
      {/* Mobile Top Navigation Header */}
      <header className="mobile-nav-header glass" style={{ background: "var(--bg-surface)", width: "100%" }}>
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #FF6B2B, #FFAA00)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            ⚡
          </div>
          <span className="font-display" style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
            Genpost
          </span>
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-primary)",
            fontSize: 24,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: 4,
          }}
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* Mobile Drawer Overlay Navigation */}
      <nav className={`mobile-nav-drawer glass ${isMobileMenuOpen ? "open" : ""}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  transition: "all 0.15s ease",
                  background: isActive ? "rgba(255,107,43,0.12)" : "transparent",
                  color: isActive ? "var(--brand-orange-light)" : "var(--text-secondary)",
                  border: isActive ? "1px solid rgba(255,107,43,0.2)" : "1px solid transparent",
                }}
              >
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="divider" style={{ margin: "8px 0" }} />
        <button
          onClick={() => {
            setIsMobileMenuOpen(false);
            handleLogout();
          }}
          className="btn-ghost"
          style={{ width: "100%", justifyContent: "flex-start", padding: "12px 14px" }}
        >
          <span style={{ fontSize: 18 }}>👋</span>
          Sign Out
        </button>
      </nav>

      {/* Desktop Sidebar (hidden on mobile) */}
      <aside
        className="glass hide-mobile"
        style={{
          width: 240,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--bg-border)",
          padding: "24px 16px",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            marginBottom: 32,
            padding: "0 8px",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg, #FF6B2B, #FFAA00)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            ⚡
          </div>
          <span className="font-display" style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>
            Genpost
          </span>
        </Link>

        {/* Nav items */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  transition: "all 0.15s ease",
                  background: isActive ? "rgba(255,107,43,0.12)" : "transparent",
                  color: isActive ? "var(--brand-orange-light)" : "var(--text-secondary)",
                  border: isActive ? "1px solid rgba(255,107,43,0.2)" : "1px solid transparent",
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="btn-ghost"
          style={{ width: "100%", justifyContent: "flex-start", padding: "10px 12px", marginTop: 8 }}
        >
          <span style={{ fontSize: 16 }}>👋</span>
          Sign Out
        </button>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", minHeight: "calc(100vh - 56px)" }}>
        {children}
      </main>
    </div>
  );
}

