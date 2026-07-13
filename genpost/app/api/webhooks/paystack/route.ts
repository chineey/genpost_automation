import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";

// Paystack sends a webhook with X-Paystack-Signature (HMAC-SHA512)
function verifyPaystackSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest("hex");
  return hash === signature;
}

const PLAN_MAP: Record<string, { plan: string; quota: number }> = {
  starter: { plan: "starter", quota: 30 },
  growth: { plan: "growth", quota: 100 },
  agency: { plan: "agency", quota: 300 },
};

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";

  if (!verifyPaystackSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body);

  if (event.event === "subscription.create" || event.event === "charge.success") {
    const data = event.data;
    // metadata.user_id and metadata.plan_key must be set when creating the subscription
    const userId = data.metadata?.user_id;
    const planKey = data.metadata?.plan_key;

    if (userId && planKey && PLAN_MAP[planKey]) {
      const { plan, quota } = PLAN_MAP[planKey];
      await query(
        `UPDATE public.users 
         SET plan = $1, monthly_post_quota = $2, paystack_customer_code = $3, paystack_subscription_code = $4 
         WHERE id = $5`,
        [plan, quota, data.customer?.customer_code, data.subscription_code, userId]
      );
    }
  }

  if (event.event === "subscription.disable" || event.event === "subscription.expiry_update") {
    const data = event.data;
    const subCode = data.subscription_code;
    if (subCode) {
      await query(
        `UPDATE public.users 
         SET plan = $1, monthly_post_quota = $2, paystack_subscription_code = $3 
         WHERE paystack_subscription_code = $4`,
        ["free", 10, null, subCode]
      );
    }
  }

  return NextResponse.json({ received: true });
}
