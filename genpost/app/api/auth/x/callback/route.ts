import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { exchangeXCode, storeXTokens } from "@/lib/x-oauth";
import { query } from "@/lib/db";

// GET /api/auth/x/callback
// X redirects here after the user authorises the app
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId stored in state
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error) {
    return NextResponse.redirect(`${appUrl}/dashboard/connect-x?error=access_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard/connect-x?error=missing_params`);
  }

  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId || userId !== state) {
      return NextResponse.redirect(`${appUrl}/dashboard/connect-x?error=unauthorized`);
    }

    // Retrieve the code_verifier from the session cookie (set when initiating the flow)
    const codeVerifier = request.headers
      .get("cookie")
      ?.split(";")
      .find((c) => c.trim().startsWith("x_code_verifier="))
      ?.split("=")[1];

    if (!codeVerifier) {
      return NextResponse.redirect(`${appUrl}/dashboard/connect-x?error=missing_verifier`);
    }

    // Exchange code for tokens
    const origin = new URL(request.url).origin;
    const tokens = await exchangeXCode(
      code,
      decodeURIComponent(codeVerifier),
      `${origin}/api/auth/x/callback`
    );

    // Fetch X account identity
    const meRes = await fetch("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const meData = meRes.ok ? await meRes.json() : null;
    const xUserId = meData?.data?.id ?? null;
    const xUsername = meData?.data?.username ?? null;

    if (xUserId) {
      // A given X account may only ever be linked to one Genpost user
      // (even one that has since disconnected) — this is what stops
      // someone from signing up repeatedly to farm free-tier quota.
      const existing = await query(
        "SELECT id FROM public.users WHERE x_user_id = $1 AND id != $2",
        [xUserId, userId]
      );
      if (existing.length > 0) {
        return NextResponse.redirect(`${appUrl}/dashboard/connect-x?error=x_already_linked`);
      }
    }

    // Store encrypted tokens
    await storeXTokens(userId, tokens);

    try {
      await query(
        "UPDATE public.users SET x_username = $1, x_user_id = coalesce($2, x_user_id) WHERE id = $3",
        [xUsername, xUserId, userId]
      );
    } catch (err: unknown) {
      // Race: another request claimed this x_user_id between our check and this write.
      if (err && typeof err === "object" && "code" in err && err.code === "23505") {
        return NextResponse.redirect(`${appUrl}/dashboard/connect-x?error=x_already_linked`);
      }
      throw err;
    }

    // Clear the verifier cookie and redirect to dashboard
    const response = NextResponse.redirect(`${appUrl}/dashboard?connected=1`);
    response.cookies.set("x_code_verifier", "", { maxAge: 0, path: "/" });
    return response;

  } catch (err) {
    console.error("X OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/dashboard/connect-x?error=callback_failed`);
  }
}
