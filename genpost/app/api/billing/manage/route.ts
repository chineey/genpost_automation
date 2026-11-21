import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

// Returns a Paystack-hosted link where the user can update their card for the subscription.
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const users = await query("SELECT paystack_subscription_code FROM public.users WHERE id = $1", [userId]);
    const code: string | null = users[0]?.paystack_subscription_code ?? null;
    if (!code) return NextResponse.json({ error: "No active subscription found." }, { status: 400 });

    const res = await fetch(`https://api.paystack.co/subscription/${encodeURIComponent(code)}/manage/link`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const data = await res.json();
    if (!data?.status || !data?.data?.link) {
      return NextResponse.json({ error: data?.message || "Could not create management link." }, { status: 502 });
    }
    return NextResponse.json({ link: data.data.link });
  } catch (err: unknown) {
    console.error("Manage subscription error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
