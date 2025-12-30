import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapStudio - Transform Selfies into Professional Headshots",
  description: "Upload a selfie and get stunning professional headshots in under a minute. AI-powered, studio-quality results for LinkedIn, company websites, and more.",
  keywords: ["AI headshots", "professional photos", "selfie transformation", "LinkedIn photos", "profile pictures", "AI photography", "headshot generator"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-zinc-950 text-zinc-100 min-h-screen selection:bg-indigo-500/30 selection:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
