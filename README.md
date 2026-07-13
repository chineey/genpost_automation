# Genpost — AI-Powered X Post SaaS

Genpost is a multi-tenant SaaS application that allows users to register, connect their X (Twitter) accounts via OAuth 2.0 PKCE, generate draft posts using Gemini AI, and schedule them for auto-publishing using a background cron runner.

The complete application is located in the [`genpost/`](./genpost) directory.

---

## ⚡ Tech Stack
- **Framework**: Next.js (App Router, TailwindCSS/PostCSS)
- **Database**: Neon (Serverless Postgres)
- **Authentication**: NextAuth (Auth.js) Credentials Flow
- **AI Engine**: Google Gemini AI (Node SDK)
- **Billing**: Stripe (USD) + Paystack (NGN) with region auto-detection
- **Automation Scheduler**: Trigger.dev background worker

---

## 🚀 Quick Start

1. Go to the project directory:
   ```bash
   cd genpost
   ```
2. Copy the environment variables template and fill in your keys:
   ```bash
   cp .env.local.example .env.local
   ```
3. Set up your Neon database schema:
   - Run the SQL queries inside [`genpost/neon/schema.sql`](./genpost/neon/schema.sql) in your Neon Console SQL Editor.
4. Follow the step-by-step [**SETUP.md**](./genpost/SETUP.md) guide for details on setting up Stripe, Paystack, X Dev App, and Trigger.dev keys.
5. Run the dev server:
   ```bash
   npm run dev
   ```
6. Start the local background task runner:
   ```bash
   npx trigger.dev@latest dev
   ```
