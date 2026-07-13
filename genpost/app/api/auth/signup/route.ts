import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { email, password, plan } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists in Neon
    const existing = await query("SELECT id FROM public.users WHERE email = $1", [cleanEmail]);
    if (existing.length > 0) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // Hash the password securely with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Default quota based on selected plan
    const planKey = plan === "starter" || plan === "growth" || plan === "agency" ? plan : "free";
    const quotaMap: Record<string, number> = { free: 10, starter: 30, growth: 100, agency: 300 };
    const quota = quotaMap[planKey];

    // Insert user into Neon database
    const users = await query(
      `INSERT INTO public.users (email, password_hash, plan, monthly_post_quota) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email`,
      [cleanEmail, passwordHash, planKey, quota]
    );

    return NextResponse.json({ user: users[0], success: true });
  } catch (err: unknown) {
    console.error("Signup endpoint error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
