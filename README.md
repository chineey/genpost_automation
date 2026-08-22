# Genpost — AI-Powered X Post SaaS

Genpost is a multi-tenant SaaS application that allows users to register, connect their X (Twitter) accounts via OAuth 2.0 PKCE, generate draft posts using Gemini AI, and schedule them for auto-publishing using a background cron runner.

The complete application is located in the [`genpost/`](./genpost) directory.

---

## 📖 Key Documentation

*   [**How It Works (System Architecture & Under the Hood)**](./how_it_works.md): Detailed explanation of schemas, token encryption, AI prompt structuring, chunked X media upload flow, and geo-routing. **Perfect for interviewers.**
*   [**Setup Guide (SETUP.md)**](./genpost/SETUP.md): Step-by-step deployment instructions for Neon, Paystack, X Developer Apps, and Trigger.dev.

---

## ⚡ Tech Stack

*   **Framework**: Next.js (App Router, Tailwind CSS, TypeScript)
*   **Database**: Neon (Serverless Postgres)
*   **Authentication**: NextAuth (Auth.js) Credentials Flow
*   **AI Engine**: Google Gemini AI (`gemini-2.5-flash` model via `@google/genai` Node SDK)
*   **Voice Personalizer**: Amnesia Memory Engine (facts/voice style mapping)
*   **Media Storage**: Cloudinary (up to 4 images or 1 video per post)
*   **Billing**: Paystack (NGN & USD) with GeoIP-based region auto-detection
*   **Automation Scheduler**: Trigger.dev background worker (performing chunked X media uploads)

---

## 🚀 Quick Start

1.  **Navigate to the project directory**:
    ```bash
    cd genpost
    ```
2.  **Configure Environment Variables**:
    Copy the template and fill in your API keys (see [**SETUP.md**](./genpost/SETUP.md) for details):
    ```bash
    cp .env.local.example .env.local
    ```
3.  **Set Up Neon Database Schema**:
    *   Run the SQL queries inside [`genpost/neon/schema.sql`](./genpost/neon/schema.sql) and [`genpost/neon/migration.sql`](./genpost/neon/migration.sql) in your Neon Console SQL Editor.
4.  **Run the Development Server**:
    ```bash
    npm run dev
    ```
5.  **Start the Local background task runner**:
    ```bash
    npx trigger.dev@latest dev
    ```
