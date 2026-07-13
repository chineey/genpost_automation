import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Genpost — AI-Powered X Post Scheduler",
    template: "%s | Genpost",
  },
  description:
    "Generate, schedule, and auto-publish high-engagement X posts with AI. Genpost turns your ideas into a consistent posting machine.",
  keywords: ["X scheduler", "Twitter scheduler", "AI post generator", "social media automation", "X automation"],
  authors: [{ name: "Genpost" }],
  openGraph: {
    title: "Genpost — AI-Powered X Post Scheduler",
    description: "Generate, schedule, and auto-publish high-engagement X posts with AI.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Genpost — AI-Powered X Post Scheduler",
    description: "Generate, schedule, and auto-publish high-engagement X posts with AI.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
