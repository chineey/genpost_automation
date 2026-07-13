# Genpost — Setup Guide

Everything you need to get Genpost running. Complete these steps **in order** before testing.

---

## 1. Neon Database Setup

### 1a. Create a Project
1. Go to [neon.tech](https://neon.tech) and sign up for a free account.
2. Create a new project (e.g. `genpost`) and select the closest region.

### 1b. Get Your Connection String
In your Neon dashboard under **Connection Details**:
- Ensure "Pooled connection" is checked (recommended for serverless environments).
- Copy the **Connection String** → `NEON_DATABASE_URL`

### 1c. Run the Schema
1. Go to **SQL Editor** in the Neon console.
2. Paste the entire contents of [`neon/schema.sql`](./neon/schema.sql).
3. Click **Run**.

---

## 1.5 NextAuth (Auth.js) Secret Setup

Generate a secure secret key to sign your authentication session tokens:
```bash
# On Linux / macOS / Git Bash / WSB:
openssl rand -base64 32
```
Or use a secure random string and assign it to `NEXTAUTH_SECRET` in your `.env.local`.


---

## 2. X (Twitter) Developer App

### 2a. Create an App
1. Go to [developer.x.com](https://developer.x.com) → Projects & Apps → Create App.
2. Create a **Project** first (required), then create an **App** inside it.

### 2b. Configure OAuth 2.0
In your App settings → **User authentication settings**:
- **OAuth 2.0**: Enable ✓
- **Type of App**: Web App, Automated App or Bot
- **App permissions**: Read and Write
- **Callback URI**: 
  - `http://localhost:3000/api/auth/x/callback` (development)
  - `https://yourdomain.com/api/auth/x/callback` (production)
- **Website URL**: Your domain

### 2c. Get Your Keys
Go to **Keys and Tokens**:
- Copy **Client ID** → `NEXT_PUBLIC_X_CLIENT_ID` and `X_CLIENT_ID`
- Copy **Client Secret** → `X_CLIENT_SECRET`

### 2d. Load API Credits
Go to your X Developer Portal billing section and add credits so posts can go through.
Set a **spending cap** to prevent runaway costs if there's a bug.

> **X API cost reminder:** $0.015/plain post, $0.20/post with link (as of mid-2026). Price your plans to cover this.

---

## 3. Token Encryption Key

Generate a secure 32-byte (256-bit) key in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output → `TOKEN_ENCRYPTION_KEY`.

**This key protects your users' X access tokens. Keep it secret and never rotate it without migrating existing encrypted tokens.**

---

## 4. Gemini API

1. Go to [aistudio.google.com](https://aistudio.google.com) → Get API Key.
2. Copy it → `GEMINI_API_KEY`.

---

## 5. Stripe Setup (USD Billing)

### 5a. Create an Account
Go to [stripe.com](https://stripe.com) → Sign up → complete verification.

### 5b. Get API Keys
Dashboard → Developers → API Keys:
- **Secret key** → `STRIPE_SECRET_KEY`

### 5c. Create Products & Prices
Go to **Products → Add Product** and create 3 products:

| Product | Price | Billing |
|---|---|---|
| Genpost Starter | $14.00 | Monthly recurring |
| Genpost Growth | $35.00 | Monthly recurring |
| Genpost Agency | $89.00 | Monthly recurring |

Copy each **Price ID** (starts with `price_...`) to the corresponding env var.

### 5d. Set Up Webhook
1. Stripe Dashboard → Developers → Webhooks → Add endpoint.
2. URL: `https://yourdomain.com/api/webhooks/stripe`
3. Events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `checkout.session.completed`
4. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`.

> For local testing, use [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

---

## 6. Paystack Setup (NGN Billing)

### 6a. Create an Account
Go to [paystack.com](https://paystack.com) → Sign up → verify your business.

### 6b. Get API Keys
Settings → API Keys & Webhooks:
- **Secret Key** → `PAYSTACK_SECRET_KEY`

### 6c. Create Plans
Go to **Subscriptions → Plans → Create Plan**:

| Plan Name | Amount | Interval |
|---|---|---|
| Genpost Starter NGN | 5,500 | monthly |
| Genpost Growth NGN | 11,000 | monthly |
| Genpost Agency NGN | 27,500 | monthly |

Copy each **Plan Code** (starts with `PLN_...`) to the env vars.

### 6d. Set Up Webhook
Settings → API Keys & Webhooks → Webhook URL:
`https://yourdomain.com/api/webhooks/paystack`

Events: `subscription.create`, `subscription.disable`, `charge.success`

---

## 7. Trigger.dev Setup (Publishing Engine)

### 7a. Create an Account
Go to [trigger.dev](https://trigger.dev) → Sign up → Create a Project.

### 7b. Initialize in the App
```bash
cd genpost
npx trigger.dev@latest init
```
Follow prompts to link to your project.

### 7c. Get Your Key
Dashboard → Project → API Keys → Copy the **Secret Key** → `TRIGGER_SECRET_KEY`.

### 7d. Deploy the Task
```bash
npx trigger.dev@latest deploy
```
Your `publish-scheduled-posts` cron task will appear in the Trigger.dev dashboard running every minute.

---

## 8. Environment Variables

Copy the template and fill everything in:
```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with all your keys from the steps above.

---

## 9. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 10. Deploy to Vercel

1. Push the `genpost/` folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → Import Project → select your repo.
3. In Vercel's **Environment Variables** panel, add every variable from `.env.local`.
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel production URL.
5. Deploy.

> After deploying, update your X Developer App's **Callback URI** to your production URL, and update your Stripe/Paystack webhook URLs too.

---

## Maintenance Reminders

- **X API pricing**: Check X's pricing page periodically — rates changed multiple times in 2026.
- **Token refresh failures**: Watch Trigger.dev logs for X token refresh errors (silent publishing failures).
- **Quota reset**: The `reset_monthly_quotas()` SQL function must be scheduled. Set it up in Supabase → Database → Cron Jobs.
- **NGN price drift**: Review NGN prices quarterly as the naira depreciates over time.
