# Genpost Application Directory

This folder contains the core Next.js application codebase for Genpost.

Please refer to the following documents for comprehensive information:
*   [**Main Project README**](../README.md): Tech stack details and quick start guide.
*   [**How It Works (System Architecture & Under the Hood)**](../how_it_works.md): Detailed explanation of database schemas, token encryption, AI generation prompt structuring, chunked X media upload flow, and geo-routing. **Perfect for interviewers.**
*   [**Setup Guide (SETUP.md)**](./SETUP.md): Step-by-step instructions for setting up Neon Postgres, NextAuth, Twitter Developer App, Token Encryption Key, Gemini API, Paystack Billing, Trigger.dev Background Worker, and local execution.

---

## ⚡ Quick Dev Commands

Run these inside this directory (`genpost/`):

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Start development server**:
    ```bash
    npm run dev
    ```
3.  **Start Trigger.dev dev server**:
    ```bash
    npx trigger.dev@latest dev
    ```
4.  **Deploy Trigger.dev tasks**:
    ```bash
    npx trigger.dev@latest deploy
    ```
