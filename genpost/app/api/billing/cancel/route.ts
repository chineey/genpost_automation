import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

const PAYSTACK = "https://api.paystack.co";
const headers = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
});

// Cancels the signed-in user's Paystack subscription and drops them to the free plan.
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const users = await query("SELECT paystack_subscription_code FROM public.users WHERE id = $1", [userId]);
    const code: string | null = users[0]?.paystack_subscription_code ?? null;
    if (!code) return NextResponse.json({ error: "No active subscription found." }, { status: 400 });

    // Paystack requires the subscription's email_token to disable it
    const subRes = await fetch(`${PAYSTACK}/subscription/${encodeURIComponent(code)}`, { headers: headers() });
    const sub = await subRes.json();
    const token = sub?.data?.email_token;
    if (!sub?.status || !token) {
      return NextResponse.json({ error: sub?.message || "Could not load subscription." }, { status: 502 });
    }

    const disableRes = await fetch(`${PAYSTACK}/subscription/disable`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ code, token }),
    });
    const disabled = await disableRes.json();
    if (!disabled?.status) {
      return NextResponse.json({ error: disabled?.message || "Could not cancel subscription." }, { status: 502 });
    }

    // Mirror the subscription.disable webhook so the UI updates immediately
    await query(
      "UPDATE public.users SET plan = 'free', monthly_post_quota = 10, paystack_subscription_code = NULL WHERE id = $1",
      [userId]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Cancel subscription error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
