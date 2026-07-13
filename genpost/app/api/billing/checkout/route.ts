import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-02-24.acacia" });

const STRIPE_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID!,
  growth: process.env.STRIPE_GROWTH_PRICE_ID!,
  agency: process.env.STRIPE_AGENCY_PRICE_ID!,
};

const PAYSTACK_PLAN_CODES: Record<string, string> = {
  starter: process.env.PAYSTACK_STARTER_PLAN_CODE!,
  growth: process.env.PAYSTACK_GROWTH_PLAN_CODE!,
  agency: process.env.PAYSTACK_AGENCY_PLAN_CODE!,
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  const userEmail = session?.user?.email;

  if (!userId || !userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planKey, currency } = await request.json();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (currency === "ngn") {
    // ── Paystack ──────────────────────────────────────────────────────────────
    const planCode = PAYSTACK_PLAN_CODES[planKey];
    if (!planCode) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail,
        plan: planCode,
        metadata: { user_id: userId, plan_key: planKey },
        callback_url: `${appUrl}/dashboard/settings?payment=success`,
      }),
    });

    const data = await res.json();
    if (!data.status) {
      return NextResponse.json({ error: data.message }, { status: 500 });
    }
    return NextResponse.json({ authorization_url: data.data.authorization_url });

  } else {
    // ── Stripe ────────────────────────────────────────────────────────────────
    const priceId = STRIPE_PRICE_IDS[planKey];
    if (!priceId) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    // Get or create Stripe customer
    const profiles = await query(
      "SELECT stripe_customer_id FROM public.users WHERE id = $1",
      [userId]
    );
    const profile = profiles[0];

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      // Store customer ID in Neon
      await query(
        "UPDATE public.users SET stripe_customer_id = $1 WHERE id = $2",
        [customerId, userId]
      );
    }

    const sessionObj = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/settings?payment=success`,
      cancel_url: `${appUrl}/dashboard/settings`,
      metadata: { user_id: userId },
      subscription_data: {
        metadata: { user_id: userId },
      },
    });

    return NextResponse.json({ url: sessionObj.url });
  }
}
