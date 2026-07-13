import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { countryToRegion, regionToCurrency } from "@/lib/geo";

export async function GET() {
  const headersList = await headers();

  // ── 1. Vercel geo header (free, automatic in Vercel production) ──────────────
  const vercelCountry = headersList.get("x-vercel-ip-country");

  if (vercelCountry) {
    const region = countryToRegion(vercelCountry);
    return NextResponse.json({
      country: vercelCountry,
      region,
      currency: regionToCurrency(region),
      source: "vercel-geo",
    });
  }

  // ── 2. Cloudflare header (if behind Cloudflare) ───────────────────────────────
  const cfCountry = headersList.get("cf-ipcountry");

  if (cfCountry && cfCountry !== "XX") {
    const region = countryToRegion(cfCountry);
    return NextResponse.json({
      country: cfCountry,
      region,
      currency: regionToCurrency(region),
      source: "cloudflare-geo",
    });
  }

  // ── 3. Local dev fallback: call ipapi.co (free, no key required) ─────────────
  // This only runs in development when neither Vercel nor Cloudflare headers exist.
  try {
    const res = await fetch("https://ipapi.co/json/", {
      signal: AbortSignal.timeout(3000), // 3s timeout
    });
    if (res.ok) {
      const data = await res.json();
      const countryCode = data.country_code ?? null;
      const region = countryToRegion(countryCode);
      return NextResponse.json({
        country: countryCode,
        region,
        currency: regionToCurrency(region),
        source: "ipapi-fallback",
      });
    }
  } catch {
    // Network unavailable or timeout — fall through to default
  }

  // ── 4. Final default: USD/global ─────────────────────────────────────────────
  return NextResponse.json({
    country: null,
    region: "global",
    currency: "usd",
    source: "default",
  });
}
