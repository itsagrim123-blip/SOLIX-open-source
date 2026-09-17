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
    <html lang="en" className="dark">
      <body className="antialiased bg-[#07090e] text-slate-100 min-h-screen relative overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* Subtle Ambient Background Light Orbs */}
        <div
          className="ambient-glow-cyan -top-40 -left-40 animate-ambient-pulse"
          aria-hidden="true"
        />
        <div
          className="ambient-glow-violet top-1/3 -right-40 animate-ambient-pulse"
          style={{ animationDelay: "4s" }}
          aria-hidden="true"
        />
        <div
          className="ambient-glow-cyan -bottom-40 left-1/3 animate-ambient-pulse"
          style={{ animationDelay: "8s" }}
          aria-hidden="true"
        />

        {children}
      </body>
    </html>
  );
}

