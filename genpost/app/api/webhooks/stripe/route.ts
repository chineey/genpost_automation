import { NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-02-24.acacia" });

const PLAN_MAP: Record<string, { plan: string; quota: number }> = {
  [process.env.STRIPE_STARTER_PRICE_ID!]: { plan: "starter", quota: 30 },
  [process.env.STRIPE_GROWTH_PRICE_ID!]: { plan: "growth", quota: 100 },
  [process.env.STRIPE_AGENCY_PRICE_ID!]: { plan: "agency", quota: 300 },
};

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id;
      const customerId = sub.customer as string;
      const planInfo = PLAN_MAP[priceId] ?? { plan: "free", quota: 10 };

      // Lookup user by Stripe customer ID
      const users = await query(
        "SELECT id FROM public.users WHERE stripe_customer_id = $1",
        [customerId]
      );
      const user = users[0];

      if (user) {
        await query(
          `UPDATE public.users 
           SET plan = $1, monthly_post_quota = $2, stripe_subscription_id = $3
           WHERE id = $4`,
          [
            sub.status === "active" ? planInfo.plan : "free",
            sub.status === "active" ? planInfo.quota : 10,
            sub.id,
            user.id,
          ]
        );
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      const users = await query(
        "SELECT id FROM public.users WHERE stripe_customer_id = $1",
        [customerId]
      );
      const user = users[0];

      if (user) {
        await query(
          `UPDATE public.users 
           SET plan = $1, monthly_post_quota = $2, stripe_subscription_id = $3
           WHERE id = $4`,
          ["free", 10, null, user.id]
        );
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const customerId = session.customer as string;

      if (userId && customerId) {
        await query(
          "UPDATE public.users SET stripe_customer_id = $1 WHERE id = $2",
          [customerId, userId]
        );
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
