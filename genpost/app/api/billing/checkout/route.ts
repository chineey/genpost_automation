import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const PAYSTACK_PLAN_CODES: Record<string, Record<string, string>> = {
  ngn: {
    starter: process.env.PAYSTACK_STARTER_PLAN_CODE!,
    growth: process.env.PAYSTACK_GROWTH_PLAN_CODE!,
    agency: process.env.PAYSTACK_AGENCY_PLAN_CODE!,
  },
  usd: {
    starter: process.env.PAYSTACK_STARTER_USD_PLAN_CODE!,
    growth: process.env.PAYSTACK_GROWTH_USD_PLAN_CODE!,
    agency: process.env.PAYSTACK_AGENCY_USD_PLAN_CODE!,
  },
};

const PAYSTACK_PLAN_AMOUNTS: Record<string, Record<string, number>> = {
  ngn: {
    starter: 550000,   // ₦5,500
    growth: 1100000,   // ₦11,000
    agency: 2750000,   // ₦27,500
  },
  usd: {
    starter: 1400,     // $14
    growth: 3500,     // $35
    agency: 8900,     // $89
  },
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    const userEmail = session?.user?.email;

    if (!userId || !userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planKey, currency } = await request.json();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    const selectedCurrency = currency === "ngn" ? "ngn" : "usd";
    const planCode = PAYSTACK_PLAN_CODES[selectedCurrency]?.[planKey];
    const planAmount = PAYSTACK_PLAN_AMOUNTS[selectedCurrency]?.[planKey];

    if (!planCode || !planAmount) {
      console.error("Checkout Configuration Error: Plan code or amount not found for", { selectedCurrency, planKey });
      return NextResponse.json({ error: "Invalid plan or currency configuration. Please ensure environment variables are set." }, { status: 400 });
    }

    console.log("Paystack Initialize Request:", {
      email: userEmail,
      amount: planAmount,
      plan: planCode,
      currency: selectedCurrency.toUpperCase(),
      callback_url: `${appUrl}/dashboard/settings?payment=success`,
    });

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail,
        amount: planAmount,
        plan: planCode,
        currency: selectedCurrency.toUpperCase(),
        metadata: { user_id: userId, plan_key: planKey },
        callback_url: `${appUrl}/dashboard/settings?payment=success`,
      }),
    });

    const data = await res.json();
    if (!data.status) {
      console.error("Paystack API initialization failed:", data);
      return NextResponse.json({ error: data.message || "Paystack initialization failed" }, { status: 500 });
    }

    return NextResponse.json({ authorization_url: data.data.authorization_url });
  } catch (err: any) {
    console.error("Checkout route error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
