import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solix — Futuristic AI Assistant",
  description: "A premium glassmorphic AI chat application powered by local and cloud AI models.",
  keywords: ["AI", "chatbot", "Ollama", "Next.js", "FastAPI", "glassmorphism"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="antialiased bg-[#07090e] text-slate-100 h-full h-[100dvh] overflow-hidden relative selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* Subtle Ambient Background Light Orbs */}
        <div
          className="ambient-glow-cyan -top-40 -left-40 animate-ambient-pulse"
          aria-hidden="true"
        />
        <div
          className="ambient-glow-violet top-1/3 -right-40 animate-ambient-pulse"
          style={{ animationDelay: "6s" }}
          aria-hidden="true"
        />
        <div
          className="ambient-glow-blue -bottom-40 left-1/4 animate-ambient-pulse"
          style={{ animationDelay: "12s" }}
          aria-hidden="true"
        />

        {children}
      </body>
    </html>
  );
}
