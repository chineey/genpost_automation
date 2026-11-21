import Link from "next/link";

export function Logo({ invert = false, href = "/" }: { invert?: boolean; href?: string }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 font-display text-xl font-bold ${invert ? "text-sidebar-accent-foreground" : "text-foreground"}`}
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">G</span>
      GenPost
    </Link>
  );
}
